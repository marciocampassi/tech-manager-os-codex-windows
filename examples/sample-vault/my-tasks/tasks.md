# Tasks

> Managed by `tech-manager-os`. Tasks are extracted from meeting notes by `tmr process` or `/tmr-inbox`.

---

## Today

```dataview
TABLE file.link AS "Task", due, owner
FROM "my-tasks"
WHERE contains(tags, "today") AND !complete
SORT due ASC
```

---

## This Week

```dataview
TABLE file.link AS "Task", due, owner
FROM "my-tasks"
WHERE contains(tags, "this-week") AND !complete
SORT due ASC
```

---

## Someday / Backlog

```dataview
TABLE file.link AS "Task", due, owner
FROM "my-tasks"
WHERE contains(tags, "someday") AND !complete
SORT file.mtime DESC
```

---

## Completed

```dataview
TABLE file.link AS "Task", file.mtime AS "Completed"
FROM "my-tasks"
WHERE complete = true
SORT file.mtime DESC
LIMIT 20
```

---

_Last updated: 2026-04-21_
