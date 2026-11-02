# Intervention Explorer

A tool for managers exploring what to try when something isn't working on their team.

Browse 102 managerial interventions — from coaching and process redesign to culture shifts and communication strategies. Pull promising ones into a consideration set, rate them, and challenge your assumptions before committing.

## How to use

1. **Describe what you're seeing** — the gap, problem, or opportunity — in the text area at the top.
2. **Browse interventions** on the left panel. Search by keyword, filter by domain (e.g. Culture, Work Design, Capability) or change mechanism (Education, Enablement, Persuasion, etc.).
3. **Add items to your consideration set** by clicking "+ Consider." The selected item appears on the right with full detail.
4. **Explore each intervention:**
   - **Change mechanisms** — what type of behavioral change this relies on
   - **Assumption** — what you're betting the real problem is if you choose this
   - **Observable signals** — what you'd see or hear that points here
   - **Examples** — real-world worked / didn't-work / dampened stories
   - **"What if..." challenges** — devil's advocate questions that point to alternative interventions
   - **Related interventions** — similar approaches to distinguish from
5. **Rate each intervention** (1–5) for fit and add notes about your thinking.
6. **Switch between items** using the nav pills at the top of the consideration panel.
7. **Export** your consideration set to the clipboard for sharing or further discussion.

## Sessions

Your work is saved automatically in your browser's localStorage. You can:

- Create multiple sessions (one per problem you're exploring)
- Switch between sessions with the dropdown
- Delete individual sessions or clear everything

## Running locally

No build step required. Serve the files with any static server:

```
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## License

MIT
