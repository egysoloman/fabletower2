from __future__ import annotations

import torch
from torch import nn


class EntityActorCritic(nn.Module):
    """Scores variable legal actions from shared mechanical action features."""

    def __init__(
        self,
        global_dim: int,
        action_dim: int,
        action_feat_dim: int,
        hidden: int = 256,
    ) -> None:
        super().__init__()
        self.global_dim = global_dim
        self.action_dim = action_dim
        self.action_feat_dim = action_feat_dim
        self.global_encoder = nn.Sequential(
            nn.Linear(global_dim, hidden), nn.LayerNorm(hidden), nn.Tanh(),
            nn.Linear(hidden, hidden), nn.Tanh(),
        )
        self.action_encoder = nn.Sequential(
            nn.Linear(action_feat_dim, hidden), nn.Tanh(), nn.Linear(hidden, hidden),
        )
        self.actor = nn.Sequential(nn.Tanh(), nn.Linear(hidden, 1))
        self.critic = nn.Sequential(
            nn.Linear(hidden * 2, hidden), nn.Tanh(), nn.Linear(hidden, 1),
        )

    def forward(self, obs: torch.Tensor, masks: torch.Tensor):
        global_state = obs[:, :self.global_dim]
        action_state = obs[:, self.global_dim:].reshape(-1, self.action_dim, self.action_feat_dim)
        g = self.global_encoder(global_state)
        a = self.action_encoder(action_state)
        logits = self.actor(g[:, None, :] + a).squeeze(-1)
        logits = logits.masked_fill(~masks.bool(), -1e9)
        weights = masks.float() / masks.float().sum(dim=1, keepdim=True).clamp_min(1)
        pooled = (a * weights[:, :, None]).sum(dim=1)
        value = self.critic(torch.cat([g, pooled], dim=-1)).squeeze(-1)
        return logits, value

    def distribution(self, obs: torch.Tensor, masks: torch.Tensor):
        logits, value = self(obs, masks)
        return torch.distributions.Categorical(logits=logits), value
