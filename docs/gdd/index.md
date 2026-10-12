# Game Design Document

**Shelf Sort Rush** · Game Design Document · tracks build `latest` (see [Changelog](./changelog))

This document describes what Shelf Sort Rush is, how it plays, and why it is built the way it is. Every number in it (timings, formulas, sizes, colours) comes from the current code. If the two disagree, the code is right and this document has a bug.

## How to read this document

Each feature carries a status:

| Badge | Meaning |
|---|---|
| <Badge type="tip" text="Live" /> | In the current build and playable at [the demo](https://tuandds.github.io/shelf-sort-rush/demo/). |
| <Badge type="warning" text="Coming soon" /> | Designed or planned, **not in the game yet**. Details may change before it ships. |

Coordinates and sizes are in **world pixels** on the 780 × 1688 game canvas (2× a 390 × 844 pt phone screen).

## Contents

| Part | Chapters |
|---|---|
| **I. Vision** | [1. Overview](./overview) |
| **II. Gameplay** | [2. Core loop](./core-loop) · [3. Rules & mechanics](./rules) |
| **III. Production** | [4. Roadmap & open questions](./roadmap) · [5. Changelog](./changelog) |

## One-paragraph summary

A match-3 shelf sorting puzzle built with Phaser 4
