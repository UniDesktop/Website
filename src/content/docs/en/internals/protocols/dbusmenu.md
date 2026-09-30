---
title: com.canonical.dbusmenu
description: The integer-keyed tree protocol behind every tray context menu on freedesktop systems.
---

The menu protocol paired with `org.kde.StatusNotifierItem`. UDA implements it in `crates/uda-platform-linux/src/tray.rs`; the exported object path is `/MenuBar`.

## Layout node

Every node is a four-field tuple with the wire signature `(ia{sv}ia{sv}v)`:

| Field | Type | Contents |
|---|---|---|
| 0 | `i` | item id |
| 1 | `a{sv}` | property map |
| 2 | `ia{sv}` | child nodes (id + properties each, wrapped in a variant) |
| 3 | `v` | icon payload — always an empty structure for UDA |

The root carries id `0` and no properties. Ids start at `1`, because `0` is the protocol's root sentinel.

## Property map

| Key | Value | Notes |
|---|---|---|
| `type` | `"standard"` / `"separator"` | a separator carries no label |
| `label` | string | omitted for separators |
| `enabled` | bool | |
| `visible` | bool | always `true`; hiding is done by removing the row |
| `toggle-type` | `"checkmark"` | present only for checkbox rows — this is what makes a shell draw a real checkbox |
| `toggle-state` | `int` | `0` / `1`, checkbox value |
| `children-display` | `"submenu"` | present when the row has children |

## Id allocation

Ids come from a single monotonic sequence shared by the whole tree, including nested submenus. A submenu allocates its own id **first**, then its children, so each submenu owns a contiguous id range.

The sequence saturates rather than wrapping: a wrapped counter would alias a live row, and the shell would address the wrong one.

## Methods

| Method | Behaviour |
|---|---|
| `GetLayout(parentId, recursionDepth, propertyNames)` | Returns `(revision, rootNode)`. A depth of 0 means "unlimited". With no menu attached, an empty root is returned rather than an error, so the shell renders nothing. |
| `GetGroupProperties(ids, propertyNames)` | Returns the `(id, props)` pairs for the requested ids, filtered to the requested names. An empty name list means "all". |
| `GetProperty(id, name)` | A single property. An unknown id, an unknown name, or no menu at all is an `InvalidArgs` error. |
| `Event(id, eventId, data, timestamp)` | A shell-reported interaction. Only `clicked` is acted on; `hovered` is logged and dropped. |
| `EventGroup(events)` | A batched variant, applied **sequentially** — the protocol requires the events in order. |
| `AboutToShow(id)` | Always `true`: rows are snapshotted per call, so a re-read is cheap and the shell can never show a stale submenu. |

## Signals

`ItemsPropertiesUpdated`, `LayoutUpdated(revision, parentId)` and `ItemActivationRequested` are declared. UDA emits `LayoutUpdated` whenever the layout changes, because the shell cannot otherwise know to re-read.

## Click dispatch

A row's callback is captured into the layout snapshot at export time. When `Event` arrives, the row is looked up by id in that snapshot and the stored closure is invoked — never a re-walk of the host's live `TrayMenu`, which may have been mutated since the layout was exported. This is what keeps a click addressed to the row the user actually saw.

The callback runs **after** the state lock is dropped: holding a guard across host code would stall every other D-Bus request.

## See also

- [StatusNotifierItem](/en/internals/protocols/statusnotifieritem/) — the companion item protocol
