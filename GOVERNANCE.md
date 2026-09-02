# Governance

Synawood is **BDFL** (benevolent dictator for life): the founder
decides product direction.

**ADRs** under `docs/adr/` are the change mechanism for architecture.
An accepted ADR is the contract. Do not silently contradict one; propose
a superseding ADR instead.

Path A open source ([ADR-0079](docs/adr/0079-oss-path-a.md)): this
private repo stays the source of truth. The public core is Apache-2.0
with empty history. `products/` stays private.

A CLA (cla-assistant) may land later. It is not required to publish
these files.
