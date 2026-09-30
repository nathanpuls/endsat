# Drop — first iPhone test

The interface lives in the public Google Sheet's **Drop!A1**, served at https://ends.at/drop. `drop-page.html` is its versioned copy. No recipient, contact, integration API key, or Shortcut internals are stored there. The queue is the existing Cloudflare Worker plus a small SQLite-backed Durable Object.

## 1. Prepare the existing action

Your screenshot shows **Send Text to Bekah Puls**:

1. Get contents of an URL, currently Ask Each Time.
2. Get text from Contents of URL.
3. Send that text to Bekah Puls.

For Drop, replace the first two actions with **Get Text from Shortcut Input** and feed that result to the existing Send Message action. Keep its recipient and message settings inside this Shortcut. If you still want the original URL-fetch behavior, duplicate it before changing those two actions. Make sure the input-based copy keeps the exact name configured in `DROP_ACTIONS`.

## 2. Pair the receiver

Open Drop on the Mac → **Connect iPhone** → **Copy key**. Put this key in the first Text action of **Drop Receiver**. The key identifies one private queue; it is sent in an Authorization header, never a public Sheet cell or query string. Keep the browser's local storage so it retains the same queue. An additional browser can use the same key through Connect iPhone → Use this key.

Receiver source: `shortcuts/Drop-Receiver.source.plist`. Rebuild it with `python3 shortcuts/build_receiver.py`; sign it on a Mac with `shortcuts sign --mode anyone --input shortcuts/Drop-Receiver.source.plist --output Drop-Receiver.shortcut`. Signing/import and execution must be verified in Apple Shortcuts; generated source alone is not evidence that the phone can run it.

If you need to build it in the editor, these are the exact actions:

1. **Text**: your Drop key.
2. **Get Contents of URL**: `https://ends.at/api/drop/next`, method **POST**, JSON body `{}`. Header **Authorization**: `Bearer ` followed by the first Text variable. Header **Content-Type**: `application/json`.
3. **Get Dictionary Value**: `job` from Contents of URL.
4. **If** job has any value:
5. Get Dictionary Value `id` from job; retain that variable.
6. Get Dictionary Value `receipt` from job; retain that variable.
7. Get Dictionary Value `text` from job.
8. Get Dictionary Value `shortcut` from job.
9. If shortcut is `Send Text to Bekah Puls`, **Run Shortcut** `Send Text to Bekah Puls` with the job's **text** as input.
10. **Get Contents of URL**: `https://ends.at/api/drop/jobs/[id]/complete`, method **POST**, same Authorization header, JSON body with `receipt` set to the job's receipt variable.
11. End both If blocks.

Do not mark completed before Run Shortcut returns. If the Shortcut fails, its job stays pending; wait five minutes before retrying. A message that actually sent but whose acknowledgement failed could be sent again on retry. Check before retrying that case. Completion means the Shortcut returned; it is not proof that a recipient read or received the message.

## 3. Prove the path before automation

Use a harmless text such as **Drop test — please ignore.**

1. Submit it from the Mac browser. The page should say **Pending**.
2. On the unlocked iPhone, manually run **Drop Receiver**. Allow the normal network/Shortcut permissions if prompted.
3. Confirm the exact text reaches the existing Shortcut and the intended message action works.
4. The Mac page should then say **Completed on your receiver**.
5. Only after this succeeds, choose an iPhone automation trigger and test with one new job while locked. Record the trigger, prompt behavior, and observed result. Do not infer unattended support from an unlocked run.

There is no push service or continuous iPhone polling in this prototype. A pending job waits until the receiver runs. No locked-phone or unattended result has been established.

## Relay contract

`DROP_ACTIONS` in `drop.js` is the one action registry. Only enabled IDs can be submitted. The receiver source is generated from it. For v1, one action is enabled.

| Endpoint | Request | Result |
| --- | --- | --- |
| GET `/api/drop/actions` | None | Enabled action registry |
| POST `/api/drop/jobs` | `{action,text}` | Saved job ID, timestamp, pending status |
| POST `/api/drop/next` | `{}` | `{job:null}` or oldest pending job with action, shortcut, exact text, ID, timestamp, status, receipt |
| POST `/api/drop/jobs/:id/complete` | `{receipt}` | Completed status |
| GET `/api/drop/jobs/:id` | None | Status and timestamp; no text payload |

All job endpoints require `Authorization: Bearer <64-character Drop key>`. Queues are isolated by the hash of this key. Retrieval leases the first job for five minutes to avoid two receivers taking it at once. Jobs expire after 24 hours; completion clears the text from the active job record. Cloudflare storage recovery/retention may retain earlier versions. Text is capped at 16,000 characters and each queue at 100 pending jobs. Responses are not cached, and the service does not log payloads or keys.

The Worker handles `/api/drop/*` independently of Sheets. `/drop` renders the first nonempty cell in the enabled connected Drop tab. Other project routes, homepage selection, and redirects keep their existing behavior.
