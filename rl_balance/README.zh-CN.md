# NEONSPIRE 独立 RL 平衡实验室

这套工具直接导入 `shared/src` 的生产规则，在无 UI 环境里训练与评估；不会复制卡牌、敌人或伤害公式，也不会修改线上游戏数据。训练、候选参数测试和导出全部位于 `rl_balance/` 与指定的输出目录。

## 为什么不是一个 PPO

单个策略很容易只找到一个最强套路。8 张 GPU 分别训练 8 个独立 masked-PPO 策略，每个策略在共同的通关奖励外带一个很小的行为偏好：

| style | 偏好 | 用途 |
|---:|---|---|
| 0 | 通用生存/通关 | 无额外偏好的基准 |
| 1 | 快攻 | 找爆发、少回合路线 |
| 2 | 防守 | 找格挡、低掉血路线 |
| 3 | 经济/精英 | 找高风险高收益路线 |
| 4 | 能力牌/自动化 | 找炮塔、装甲、病毒等引擎 |
| 5 | 连招 | 找零费、抽牌、单回合高频出牌 |
| 6 | 角色机制 | 找腐蚀、热量、排气、姿态、Focus |
| 7 | 精简牌组 | 找删牌、升级、少拿牌路线 |

最终的“流派”不采用这些 style 名字，也不采用游戏内手写标签。`discover.py` 只选通关或到达指定层数的轨迹，用实际行为向量聚类，再计算每个簇的关键卡 lift。style 只负责提高探索多样性。

## 一小时 8×L20

服务器首次准备（运行时安装在 `/opt/neonspire-rl/runtime`）：

```bash
cd /opt/neonspire-rl/fabletower2
bash rl_balance/bootstrap_server.sh
export PATH=/opt/neonspire-rl/runtime/node/bin:$PATH
export PYTHON_BIN=/opt/neonspire-rl/runtime/conda/bin/python
```

一键训练 46 分钟，剩余时间做四组候选的同 seed 评估和流派聚类：

```bash
bash rl_balance/launch_8gpu.sh
```

默认每张卡 512 个并行环境、8 个 Node 模拟器进程。服务器 CPU 若成为瓶颈，优先调整：

```bash
ENVS_PER_GPU=256 SIM_WORKERS=8 TRAIN_MINUTES=46 EVAL_EPISODES=512 \
  bash rl_balance/launch_8gpu.sh /opt/neonspire-rl/results/run-01
```

训练中查看：

```bash
watch -n 5 nvidia-smi
tail -f /opt/neonspire-rl/results/run-01/style-0/train.log
```

## 平衡参数模拟

候选配置是进程级覆盖，只在独立模拟器内生效。它现在与正式客户端和权威服务器共用 `shared/src/balance.ts` 的补丁解析器，因此候选进入生产补丁时不会再有第二套合并语义。示例见 `configs/candidates.example.json`：

```json
[
  { "name": "baseline" },
  {
    "name": "enemy_minus_5pct",
    "enemyHpMultiplier": 0.95,
    "enemyAttackMultiplier": 0.95
  },
  {
    "name": "vent_blade_cost_test",
    "cardPatches": { "ventblade": { "cost": 0 } }
  }
]
```

支持字段：

- `enemyHpMultiplier`、`enemyAttackMultiplier`：全体敌人的测试倍率；
- `playerMaxHpMultiplier`、`startingGoldMultiplier`：全局玩家参数；
- `cardPatches`、`enemyPatches`、`relicPatches`：按稳定 id 深合并；数组（例如 `effects`、`hp`）整体替换。
- `mechanicsTuning`：姿态回能、潜行退出、召唤叠层/协同和角色生命修正；
- `balanceStack`：直接选择引擎内置的完整版本化候选栈，避免 JSON 重复机制补丁。

机制候选示例见 `configs/mechanics-candidates-20260801.json`。旧 checkpoint
兼容要求新增观测特征只能追加，不能插入既有特征中间；当前 `Stable` 已追加在
状态向量末尾，原有特征索引保持不变。

单独重跑候选评估：

```bash
$PYTHON_BIN rl_balance/python/simulate.py \
  --checkpoints /opt/neonspire-rl/results/run-01 \
  --configs rl_balance/configs/candidates.example.json \
  --output /opt/neonspire-rl/results/run-01/simulation-2 \
  --episodes 1024 --gpus 8
```

这是“现有策略对改动的零样本反应”，适合快速筛候选。若改动改变了最优 meta，需要复制候选配置为训练 `--config` 并重新训练，才能测新平衡下的策略均衡点。

## 输出数据

每次运行输出：

- `style-N/final.pt`：8 个独立策略检查点；
- `style-N/train_episodes/*.jsonl`：训练逐局轨迹摘要；
- `simulation/<config>/style-N/episodes/*.jsonl`：严格同 seed 的逐局评估；
- `summary.json` / `summary.csv` / `episodes.csv`：角色胜率、层数分位、掉血和回合数；
- `simulation/paired_comparison.csv`：每个策略、角色、候选相对 baseline 的层数差和 bootstrap 95% CI；
- `simulation/paired_population.json`：8 策略总体差异；
- `simulation/discovered/archetypes.json` / `.csv`：自动发现的流派、行为特征、关键卡和强度。

逐局 JSONL 还包含完整最终牌组、遗物、出牌计数、选牌计数与 31 个行为指标，可直接导入 DuckDB、ClickHouse、Pandas 或 BI 工具。

## 判定平衡问题

不要只看胜率。建议同时使用：

1. 同 seed 的层数差与置信区间；
2. 各流派的通关率、均层、P25/P90（稳定性）；
3. 一个角色被发现的有效流派数与策略覆盖率；
4. 关键卡的 cluster lift 和拿取后反事实测试；
5. style 0 与其他 style 的差距（上手下限与专精收益）。

某张卡的“高拿取率 + 高胜率”不等于因果增强，因为强局更容易看到稀有牌。正式改数值前，应把该卡做小幅 patch，并用相同 checkpoint、character、style、seed 做配对比较；候选通过后再重新训练验证 meta 是否迁移。

## 测试

不需要 PyTorch/GPU 的引擎协议 smoke test：

```bash
python3 rl_balance/tests/smoke_protocol.py
```

服务器 bootstrap 还会对 8 张 GPU 分别执行矩阵乘法，确认 PyTorch、CUDA 和设备可见性。

## 当前边界

- 这是单人爬塔平衡实验，不训练 PvP 或协力；
- 药剂奖励在有空槽时自动拾取，免费精英/宝箱遗物自动拾取；其他关键决定（战斗、路线、奖励选牌、Boss 遗物、商店、事件、休息、删牌、是否下潜）由策略选择；
- 训练奖励有轻量 dense shaping，但最终所有平衡报表只使用真实胜负、层数、HP、回合与牌组数据；
- 一小时用于初筛和发现信号，不足以宣称收敛。稳定结论应至少用 3 个训练种子和保留 seed 集复验。
