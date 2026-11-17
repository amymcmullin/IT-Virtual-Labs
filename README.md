# IT Virtual Labs

Browser-based, hands-on practice labs for the Computer Systems & Information Technology program at Immokalee Technical College. A student works a help desk ticket on a simulated PC and gets a step-by-step report: which steps they met, which they missed and why, and a timeline of what they did.

Everything runs in the browser. There is no server, no account and no student data collected.

## What is here

| Path | Purpose |
|---|---|
| `index.html` | Lab catalog. Filter by certification, or show an assigned set with `?set=NAME`. |
| `lab.html` | Lab player. `?lab=ID&mode=practice` or `&mode=graded`. |
| `instructor.html` | Decoder for completion codes: per-student results and the steps missed most. |
| `labs/catalog.json` | The list of labs, their exam objectives, and the assigned sets. |
| `labs/*.json` | One file per lab: scenario, starting state, hints and the checks that are graded. |
| `js/` | The engine (`engine.js`), grading (`grading.js`), network model (`net.js`) and simulated tools (`surfaces.js` for Command Prompt and Network Settings, `bench.js` for the hardware workbench, `printers.js` for Printers and Services, `dir.js` for Users and Groups, Shared Folders and Access Test, `router.js` for the router admin page, `malware.js` for Task Manager, Security, System and Talk to the User). |
| `scorm/launcher/` | Template for the thin SCORM 1.2 launcher used in Canvas. |
| `tools/build_launchers.py` | Builds one launcher zip per lab into `scorm/dist/`. |
| `docs/` | Draft crosswalk of Tech+, CCST IT Support and A+ objectives, and the lab build order. |

## Modes

- **Practice**: hints and a live checklist. Nothing is sent anywhere.
- **Graded**: no hints. The report appears on submit; inside Canvas the score goes to the gradebook.

## Canvas

Upload a zip from `scorm/dist/` through the SCORM tool as a graded assignment. The zip contains only a small page that loads the lab from this site and relays the score, so fixes published here reach every course without re-uploading. The launcher never lowers a score already recorded.

## Adding a lab

1. Copy a file in `labs/`, change the scenario, `initialState`, `world`, `hints` and `checks`.
2. Add an entry to `labs/catalog.json` with its exam objectives.
3. Run `python3 tools/build_launchers.py` if it needs a Canvas launcher.

## Limits to know about

- Grading runs in the student's browser. Completion codes and scores deter casual tampering; they are not proof. Do not use these labs for high-stakes assessment.
- Progress and best scores shown in the catalog are stored on the device only.
- The simulated tools imitate the behaviour of common operating system tools; they are not copies of any vendor's software.

## How this was made

The idea, the requirements (practice and graded modes, step-by-step feedback, instructor-chosen and student-chosen labs, the Canvas launcher approach, the certifications to align to) and the review of the result are Amy McMullin's. The code, the first lab scenario and the draft crosswalk were written with AI assistance (Claude) to her specification. Exam objective numbers were taken from the published objectives documents for CompTIA Tech+ FC0-U71, CompTIA A+ 220-1201 and 220-1202, and Cisco CCST IT Support.

CompTIA, A+, Tech+, Cisco and CCST are trademarks of their owners. This project is not affiliated with or endorsed by them.

## License

No license has been chosen yet. All rights reserved by the author until one is added.
