# Feedback eval cases

Generated from `cases.json` by `cases-to-md.mjs`. 48 cases.

| Level | Cases | Avg candidate words |
|---|---|---|
| strong | 16 | 181 |
| average | 13 | 70 |
| weak | 16 | 81 |
| non_answer | 3 | 13 |

| id | round | question | level | tags |
|---|---|---|---|---|
| [technical/two-sum/strong](#technicaltwo-sumstrong) | technical | two-sum | strong |  |
| [technical/two-sum/average](#technicaltwo-sumaverage) | technical | two-sum | average |  |
| [technical/two-sum/weak](#technicaltwo-sumweak) | technical | two-sum | weak |  |
| [technical/merge-intervals/strong](#technicalmerge-intervalsstrong) | technical | merge-intervals | strong |  |
| [technical/merge-intervals/average](#technicalmerge-intervalsaverage) | technical | merge-intervals | average |  |
| [technical/merge-intervals/weak](#technicalmerge-intervalsweak) | technical | merge-intervals | weak |  |
| [technical/valid-bst/strong](#technicalvalid-bststrong) | technical | valid-bst | strong |  |
| [technical/valid-bst/average](#technicalvalid-bstaverage) | technical | valid-bst | average |  |
| [technical/valid-bst/weak](#technicalvalid-bstweak) | technical | valid-bst | weak |  |
| [technical/lru-cache/strong](#technicallru-cachestrong) | technical | lru-cache | strong |  |
| [technical/lru-cache/average](#technicallru-cacheaverage) | technical | lru-cache | average |  |
| [technical/lru-cache/weak](#technicallru-cacheweak) | technical | lru-cache | weak |  |
| [behavioral/proudest-project/strong](#behavioralproudest-projectstrong) | behavioral | proudest-project | strong |  |
| [behavioral/proudest-project/average](#behavioralproudest-projectaverage) | behavioral | proudest-project | average |  |
| [behavioral/proudest-project/weak](#behavioralproudest-projectweak) | behavioral | proudest-project | weak |  |
| [behavioral/conflict/strong](#behavioralconflictstrong) | behavioral | conflict | strong |  |
| [behavioral/conflict/average](#behavioralconflictaverage) | behavioral | conflict | average |  |
| [behavioral/conflict/weak](#behavioralconflictweak) | behavioral | conflict | weak |  |
| [behavioral/failure/strong](#behavioralfailurestrong) | behavioral | failure | strong |  |
| [behavioral/failure/average](#behavioralfailureaverage) | behavioral | failure | average |  |
| [behavioral/failure/weak](#behavioralfailureweak) | behavioral | failure | weak |  |
| [behavioral/tight-deadline/strong](#behavioraltight-deadlinestrong) | behavioral | tight-deadline | strong |  |
| [behavioral/tight-deadline/average](#behavioraltight-deadlineaverage) | behavioral | tight-deadline | average |  |
| [behavioral/tight-deadline/weak](#behavioraltight-deadlineweak) | behavioral | tight-deadline | weak |  |
| [behavioral/learn-fast/strong](#behaviorallearn-faststrong) | behavioral | learn-fast | strong |  |
| [behavioral/learn-fast/average](#behaviorallearn-fastaverage) | behavioral | learn-fast | average |  |
| [behavioral/learn-fast/weak](#behaviorallearn-fastweak) | behavioral | learn-fast | weak |  |
| [behavioral/initiative/strong](#behavioralinitiativestrong) | behavioral | initiative | strong |  |
| [behavioral/initiative/average](#behavioralinitiativeaverage) | behavioral | initiative | average |  |
| [behavioral/initiative/weak](#behavioralinitiativeweak) | behavioral | initiative | weak |  |
| [system-design/url-shortener/strong](#system-designurl-shortenerstrong) | system-design | url-shortener | strong |  |
| [system-design/url-shortener/average](#system-designurl-shorteneraverage) | system-design | url-shortener | average |  |
| [system-design/url-shortener/weak](#system-designurl-shortenerweak) | system-design | url-shortener | weak |  |
| [system-design/rate-limiter/strong](#system-designrate-limiterstrong) | system-design | rate-limiter | strong |  |
| [system-design/rate-limiter/average](#system-designrate-limiteraverage) | system-design | rate-limiter | average |  |
| [system-design/rate-limiter/weak](#system-designrate-limiterweak) | system-design | rate-limiter | weak |  |
| [system-design/chat-app/strong](#system-designchat-appstrong) | system-design | chat-app | strong |  |
| [system-design/chat-app/average](#system-designchat-appaverage) | system-design | chat-app | average |  |
| [system-design/chat-app/weak](#system-designchat-appweak) | system-design | chat-app | weak |  |
| [technical/two-sum/strong-concise](#technicaltwo-sumstrong-concise) | technical | two-sum | strong | length-trap |
| [technical/valid-bst/weak-verbose](#technicalvalid-bstweak-verbose) | technical | valid-bst | weak | length-trap |
| [behavioral/failure/strong-concise](#behavioralfailurestrong-concise) | behavioral | failure | strong | length-trap |
| [behavioral/conflict/weak-verbose](#behavioralconflictweak-verbose) | behavioral | conflict | weak | length-trap |
| [system-design/url-shortener/strong-concise](#system-designurl-shortenerstrong-concise) | system-design | url-shortener | strong | length-trap |
| [system-design/rate-limiter/weak-verbose](#system-designrate-limiterweak-verbose) | system-design | rate-limiter | weak | length-trap |
| [technical/two-sum/non-answer](#technicaltwo-sumnon-answer) | technical | two-sum | non_answer |  |
| [behavioral/conflict/non-answer](#behavioralconflictnon-answer) | behavioral | conflict | non_answer |  |
| [system-design/url-shortener/non-answer](#system-designurl-shortenernon-answer) | system-design | url-shortener | non_answer |  |

## technical/two-sum/strong

```text
Interviewer: Given an array of integers and a target number, return the indices of the two numbers that add up to the target.

Candidate: Okay, quick clarifying questions. Is there always exactly one valid pair, and can I use the same element twice? I'll assume exactly one answer and no reusing an element. The brute force is two nested loops checking every pair, which is O of n squared time and constant space. To do better, I'd make one pass with a hash map from value to index. For each number I compute target minus that number and check if it's already in the map. If it is, I return both indices. If not, I store the current number and its index. That's O of n time and O of n extra space for the map. Quick example: 2, 7, 11, 15 with target 9. At 2 the map is empty, so I store 2 at index 0. At 7 the complement is 2, which is in the map, so I return 0 and 1. And duplicates like 3, 3 with target 6 still work because I check before inserting.

Interviewer [follow_up]: What if the array is already sorted? Can you do it with less extra memory?

Candidate: If it's sorted I'd use two pointers, one at each end. If the sum is too small, move the left pointer right. If it's too big, move the right pointer left. That's O of n time and constant space. If the input weren't sorted, sorting first would cost n log n and I'd lose the original indices unless I kept them alongside, so for unsorted input the hash map is still better.
```

## technical/two-sum/average

```text
Interviewer: Given an array of integers and a target number, return the indices of the two numbers that add up to the target.

Candidate: Um, so I'd do two for loops. For each i, and each j after i, check if they add up to the target and return them. That works. To make it faster I think you can use a hash map, like store the numbers and check if target minus the number is in there. That's faster, like O of n.

Interviewer [follow_up]: What if the array is already sorted? Can you do it with less extra memory?

Candidate: If it's sorted, maybe binary search for the complement of each number? That would be n log n. I'm not totally sure about the memory part, I think binary search doesn't use extra memory.
```

## technical/two-sum/weak

```text
Interviewer: Given an array of integers and a target number, return the indices of the two numbers that add up to the target.

Candidate: I would sort the array first and then go through it and add the numbers that are next to each other until I find two that add up to the target, and then return those indices.

Interviewer [follow_up]: What if the array is already sorted? Can you do it with less extra memory?

Candidate: Then it's easier because you don't need to sort, you just check the numbers next to each other. Memory is fine since it's just the one array.
```

## technical/merge-intervals/strong

```text
Interviewer: You're given a list of time intervals, each with a start and an end. Merge all the intervals that overlap.

Candidate: Before I start: if two intervals just touch, like 1 to 2 and 2 to 3, should they merge? And is the input sorted? I'll assume touching ones merge and the input isn't sorted. I'd sort by start time, which is n log n. Then I walk through keeping a current merged interval. If the next interval starts at or before the current end, I extend the current end to the max of the two ends. Otherwise I push the current one to the result and start a new one. The max matters when one interval is fully inside another, like 1 to 10 and then 2 to 3. Overall O of n log n time and O of n for the output. For example, 1 to 3, 2 to 6, 8 to 10, 15 to 18 gives 1 to 6, 8 to 10, and 15 to 18.

Interviewer [follow_up]: Now say the list is already merged and sorted, and I give you one new interval to insert. Can you beat n log n?

Candidate: Yes, that's linear. I'd copy over every interval that ends before the new one starts, then merge every interval that overlaps the new one by taking the min start and max end, then copy the rest. One pass, O of n. You could binary search for where the overlap starts, but you still have to build the output, so it stays O of n overall.
```

## technical/merge-intervals/average

```text
Interviewer: You're given a list of time intervals, each with a start and an end. Merge all the intervals that overlap.

Candidate: So I'd sort them by the start, and then go through, and if the next one starts before the current one ends, merge them by setting the end to the next one's end. Otherwise add it to the result. Sorting is n log n.

Interviewer [follow_up]: Why do you take the next interval's end there? What if one interval is inside another?

Candidate: Oh, hmm. If the second one is inside the first one, its end is smaller, so I'd actually shrink the interval. Yeah, it should be the max of the two ends. I'd fix that.
```

## technical/merge-intervals/weak

```text
Interviewer: You're given a list of time intervals, each with a start and an end. Merge all the intervals that overlap.

Candidate: I'd compare every interval with every other interval, and if they overlap I'd combine them, and keep doing that until nothing changes anymore.

Interviewer [hint]: Would it help to look at the intervals in some particular order?

Candidate: Maybe sort them? I'm not sure how that would help though, I'd still need to check all the pairs to be safe.
```

## technical/valid-bst/strong

```text
Interviewer: How would you check whether a binary tree is a valid binary search tree?

Candidate: The trap is that checking each node against just its children isn't enough. For example, root 5, left child 3, and 3 has a right child 6. Every parent-child pair looks fine, but 6 is in the left subtree of 5, so it's invalid. So I'd recurse while passing down a lower and upper bound. The root has no bounds. Going left, the upper bound becomes the current value; going right, the lower bound becomes the current value. Each node must be strictly inside its bounds. That's O of n time and O of h space for the recursion, where h is the height. Should duplicates be allowed? I've assumed not, which is why the bounds are strict.

Interviewer [follow_up]: How does your space usage change for a very unbalanced tree? Could you avoid recursion?

Candidate: If the tree is basically a linked list, h is n, so the recursion is O of n deep and could overflow the stack. I could do an iterative in-order traversal with an explicit stack and check that each value is strictly greater than the previous one. Same O of n time, and no recursion limit, though the stack can still hold O of h nodes.
```

## technical/valid-bst/average

```text
Interviewer: How would you check whether a binary tree is a valid binary search tree?

Candidate: I'd do an in-order traversal and put all the values in a list, and then check that the list is sorted. If it's sorted, it's a valid BST. That's O of n time and O of n space for the list.

Interviewer [follow_up]: Can you give me a tree where checking each node against only its children gives the wrong answer?

Candidate: Um, let me think. Maybe if a node deeper down is bigger than something higher up? Like, the root is 5 and somewhere on the left there's a 6? I'm not sure exactly how to draw it, but I think that's why the in-order approach is safer.
```

## technical/valid-bst/weak

```text
Interviewer: How would you check whether a binary tree is a valid binary search tree?

Candidate: For each node, I'd check that the left child is smaller and the right child is bigger. If that's true for every node then it's valid.

Interviewer [follow_up]: Can you give me a tree where checking each node against only its children gives the wrong answer?

Candidate: I don't think there is one, because every node gets checked, so if all of them are right then the whole tree is right.
```

## technical/lru-cache/strong

```text
Interviewer: Design a data structure for a least-recently-used cache, with get and put operations that both run in constant time.

Candidate: I need two things in constant time: finding a key, and knowing which key was used least recently. So I'd combine a hash map from key to node with a doubly linked list ordered by recency, most recent at the head. On get, I look up the node in the map, move it to the head, and return its value. On put, if the key exists I update it and move it to the head. If it's new, I create a node at the head and add it to the map, and if that puts me over capacity I remove the tail node and also delete its key from the map. Every step is O of 1. I'd use dummy head and tail nodes so I don't need special cases for an empty list.

Interviewer [follow_up]: Why does the list need to be doubly linked?

Candidate: Because on a get I have to unlink a node from the middle of the list. With only next pointers, I'd need the previous node, and finding it means walking the list, which is O of n. With a prev pointer I can unlink it directly in O of 1. Same for removing the tail on eviction.
```

## technical/lru-cache/average

```text
Interviewer: Design a data structure for a least-recently-used cache, with get and put operations that both run in constant time.

Candidate: I'd use a hash map for the key-value pairs so get is constant time, and a linked list to keep track of the order things were used. When you use something you move it to the front, and when the cache is full you remove from the back.

Interviewer [follow_up]: Why does the list need to be doubly linked?

Candidate: I think a singly linked list would also work? You just move things to the front. Maybe doubly linked makes removing from the back easier. I'm not completely sure it's required.
```

## technical/lru-cache/weak

```text
Interviewer: Design a data structure for a least-recently-used cache, with get and put operations that both run in constant time.

Candidate: I'd store the items in an array along with a timestamp of when each was last used. On get, I find the item and update its timestamp. When the cache is full, I find the item with the oldest timestamp and remove it. That's all constant time.

Interviewer [follow_up]: How do you find the item with the oldest timestamp?

Candidate: I'd loop through the array and keep track of the smallest timestamp. It's pretty fast since the cache isn't that big.
```

## behavioral/proudest-project/strong

```text
Interviewer: Tell me about a project you're most proud of.

Candidate: Last summer I built a course-waitlist notifier for my university with two friends. Students were refreshing the registration page for hours to catch open seats. I owned the backend: I wrote the scraper that checked seat counts every two minutes and the notification service that texted students when a seat opened. The hardest part was that the registration site rate-limited us after about a day. I redesigned it to batch requests by course instead of by student, which cut our requests by about 90 percent and got us under the limit. By the end of the add-drop period, around 1,400 students had signed up, and about 600 got into a class they'd been waitlisted for. If I did it again, I'd talk to the registrar's office first, because we eventually had to negotiate access after the fact.

Interviewer [follow_up]: What part of that was specifically yours?

Candidate: The scraper, the batching redesign, and the notification service were mine. One friend built the sign-up page and the other handled outreach to student groups. I also set up the alerts that told us when the scraper failed, because twice it broke at night when the site changed its HTML.
```

## behavioral/proudest-project/average

```text
Interviewer: Tell me about a project you're most proud of.

Candidate: We built a course-waitlist notifier at a hackathon. It texts students when a seat opens up in a class. We used Python and Twilio and a little React frontend. We had some issues with rate limits but we figured it out. A lot of students ended up using it and we got good feedback, so it went pretty well.

Interviewer [follow_up]: What part of that was specifically yours?

Candidate: I worked on the backend mostly, like the scraping part. We all kind of did a bit of everything though.
```

## behavioral/proudest-project/weak

```text
Interviewer: Tell me about a project you're most proud of.

Candidate: I'm proud of a lot of my projects. I really like building things, and I'm passionate about technology and solving problems. I've done projects with React, Node, Python, and some machine learning, so I have a lot of experience with different tools.

Interviewer [follow_up]: Can you pick one and tell me what you specifically did on it?

Candidate: Probably the machine learning one. We made a model that predicts things from data. It was cool to see it working.
```

## behavioral/conflict/strong

```text
Interviewer: Tell me about a time you disagreed with a teammate. How did you handle it?

Candidate: In my software engineering course, our team of four was building a study-group app with a three-week deadline. A teammate wanted to switch from our REST API to GraphQL halfway through. I disagreed because none of us had used it and we had a demo in ten days. Instead of arguing in the group chat, I asked him to walk me through why. His real concern was that our mobile screens were making five requests each and loading slowly. That was a fair point. So I suggested we time-box it: I'd spend one evening adding two combined REST endpoints for the slowest screens, and if load times didn't improve, we'd revisit GraphQL. Load time on those screens went from about four seconds to under one, he agreed that solved it, and we shipped the demo on time. What I learned is to look for the problem behind someone's proposal before debating the proposal itself.

Interviewer [follow_up]: What would you have done if he still hadn't agreed?

Candidate: I'd have suggested we take it to the whole team with the trade-off laid out, the demo risk against the long-term benefit, and agree to go with the group's call. And I'd have offered to help him prototype it after the demo so his idea didn't just get dropped.
```

## behavioral/conflict/average

```text
Interviewer: Tell me about a time you disagreed with a teammate. How did you handle it?

Candidate: On a class project, a teammate wanted to switch our backend to GraphQL partway through. I didn't think it was a good idea because of the deadline. We talked about it and decided to stay with REST and make some optimizations instead. It worked out and we finished on time.

Interviewer [follow_up]: What did your teammate believe, and why did they think that?

Candidate: He thought GraphQL would be better and faster. I think he'd read about it online. We just explained that it was too risky with the deadline.
```

## behavioral/conflict/weak

```text
Interviewer: Tell me about a time you disagreed with a teammate. How did you handle it?

Candidate: Honestly I get along with pretty much everyone, so I don't really have disagreements. If I did, I would listen to their point of view and try to find a compromise.

Interviewer [follow_up]: Can you think of a real example, even a small one?

Candidate: Once in a group project one person wasn't doing their part and it was really frustrating, so we told the professor and he dealt with it.
```

## behavioral/failure/strong

```text
Interviewer: Tell me about a time you failed or made a mistake.

Candidate: During my internship I pushed a database migration that renamed a column, and I only tested it against my local data. In staging it broke the nightly report job, and the analytics team's dashboard was empty the next morning. When I saw the alert, I told my mentor right away, rolled back the migration, and re-ran the report job, so the dashboard was back by about 10 a.m. Then I wrote a short postmortem. The root cause was that I didn't search for other code reading that column. I added a step to our migration checklist to grep every service for the column name, and I changed my migrations to add the new column first and remove the old one in a later release. Two months later I did another rename that touched three services, and it went through with no breakage.

Interviewer [follow_up]: What specifically do you do differently now?

Candidate: I never rename or drop a column in one step anymore. I add, migrate the readers, then remove. And before any schema change I search every repository that touches that database, not just the one I'm working in.
```

## behavioral/failure/average

```text
Interviewer: Tell me about a time you failed or made a mistake.

Candidate: At my internship I made a database change that broke a report the next morning. I rolled it back and fixed it pretty quickly. I learned that I should test things more carefully before pushing them.

Interviewer [follow_up]: What specifically do you do differently now?

Candidate: I just test more thoroughly now, and I double check things before I merge.
```

## behavioral/failure/weak

```text
Interviewer: Tell me about a time you failed or made a mistake.

Candidate: I'd say my biggest weakness is that I'm a perfectionist and I work too hard. Sometimes I spend too long making things perfect.

Interviewer [follow_up]: Can you tell me about a specific time something actually went wrong?

Candidate: There was a group project where we missed the deadline, but that was mostly because the requirements kept changing and one teammate didn't finish their part on time.
```

## behavioral/tight-deadline/strong

```text
Interviewer: Tell me about a time you had a tight deadline or too many things to do at once.

Candidate: In my final term I had a capstone demo, two midterms, and my part-time TA job all in the same week. On Sunday I listed everything with its deadline and what was at stake. The demo was 40 percent of the capstone grade and the team depended on my payment integration, so that came first. I emailed the professor I TA for on Sunday night, before anything slipped, and swapped my grading shift with another TA in exchange for taking hers the following week. For the capstone, I told the team on Monday that I'd ship payments with card support only and cut Apple Pay, which was a nice-to-have. The demo went smoothly, I got an 85 and an 88 on the midterms, and the grading still got done on time. Next time I'd look at the term calendar at the start, because that week was predictable.

Interviewer [follow_up]: How did you decide what to drop or delay?

Candidate: I ranked by two things: how much was at stake and whether other people depended on it. The demo scored high on both. Apple Pay was low on both, since nobody else was blocked on it, so it was the easy cut. The grading shift mattered to other people, so instead of dropping it I traded it.
```

## behavioral/tight-deadline/average

```text
Interviewer: Tell me about a time you had a tight deadline or too many things to do at once.

Candidate: In my last semester I had a capstone demo and midterms in the same week. I made a to-do list and prioritized the most important things. It was a really busy week, but I got through it and the demo went well.

Interviewer [follow_up]: How did you decide what was most important?

Candidate: I just looked at what was due first and what was worth the most, and did those first.
```

## behavioral/tight-deadline/weak

```text
Interviewer: Tell me about a time you had a tight deadline or too many things to do at once.

Candidate: I work well under pressure. When I have a lot to do I just stay up late and get it all done. I pulled a couple of all-nighters during finals and it was fine.

Interviewer [follow_up]: Did you have to drop or delay anything, or tell anyone about it?

Candidate: No, I just did everything myself. I didn't want to bother anyone.
```

## behavioral/learn-fast/strong

```text
Interviewer: Tell me about a time you had to learn something new very quickly.

Candidate: Two weeks into my internship, my team's only iOS developer went on leave, and a bug was crashing the app for about 3 percent of users on older phones. I'd never written Swift. I set a goal of being able to reproduce and fix that one crash within a week, rather than learning iOS in general. I spent the first day on Apple's Swift tour and our app's architecture doc, then read the crash logs to find the screen involved. I booked two 30-minute sessions with an Android engineer on my team who knew the shared code. By day four I could reproduce it: a force-unwrapped optional when a phone had no camera permission. I fixed it, added a test, and crashes from that cause dropped to zero in the next release. Scoping the learning to the actual problem is what made it doable.

Interviewer [follow_up]: How did you know you'd learned enough to deliver?

Candidate: My bar was that I could explain the crash, fix it, and write a test that failed before the fix and passed after. Once I had that, plus a code review from the Android engineer, I felt confident shipping it.
```

## behavioral/learn-fast/average

```text
Interviewer: Tell me about a time you had to learn something new very quickly.

Candidate: At my internship I had to learn Swift to fix an iOS bug because our iOS developer was away. I watched some tutorials and read the documentation, and after a few days I was able to fix the bug.

Interviewer [follow_up]: How did you decide what to learn first and what to skip?

Candidate: I mostly just started with the basics, like the syntax, and then looked at our code.
```

## behavioral/learn-fast/weak

```text
Interviewer: Tell me about a time you had to learn something new very quickly.

Candidate: I'm a really fast learner. I've learned a lot of programming languages, like Python, Java, C++, JavaScript, and Swift. I usually pick things up in a few days.

Interviewer [follow_up]: Can you walk me through one specific time and how you went about it?

Candidate: For Swift, I just learned it. I watched YouTube videos and practiced. It wasn't hard.
```

## behavioral/initiative/strong

```text
Interviewer: Tell me about a time you went beyond what was asked of you.

Candidate: As a TA for intro programming, I noticed that every week about a third of office-hours questions were the same setup problem: students' Python environments pointing at the wrong version. It wasn't my job to fix, since I was just assigned to answer questions. I wrote a one-page setup guide and a small script that checked the student's environment and printed exactly what to fix. I showed it to the head TA first to make sure it matched what the course wanted, and she asked me to post it on the course page. Setup questions in office hours dropped from around 15 a week to two or three, and the professor kept the script for the next term.

Interviewer [follow_up]: Did anyone push back? How did you get buy-in?

Candidate: One TA worried the script would confuse students if it gave a wrong diagnosis. So I tested it on the lab machines and on six classmates' laptops first, and added a line telling students to come to office hours if the script's advice didn't work. That addressed his concern.
```

## behavioral/initiative/average

```text
Interviewer: Tell me about a time you went beyond what was asked of you.

Candidate: When I was a TA, a lot of students had setup problems, so I made a guide to help them set up Python. It helped a lot of students and the professor liked it.

Interviewer [follow_up]: How did you notice the problem in the first place?

Candidate: I just saw that a lot of people were asking about it in office hours.
```

## behavioral/initiative/weak

```text
Interviewer: Tell me about a time you went beyond what was asked of you.

Candidate: I always try to go above and beyond. At my part-time job I always showed up on time and finished my tasks, and my manager said I was reliable.

Interviewer [follow_up]: Is there a time you did something nobody had asked you to do?

Candidate: I sometimes stayed a bit later to finish things, if that counts.
```

## system-design/url-shortener/strong

```text
Interviewer: Let's design a URL shortener, something like bit.ly.

Candidate: Let me start with requirements. Core features: create a short link from a long URL, and redirect from the short link. Nice-to-haves: custom aliases, expiration, and click counts. For scale, let's say 100 million new links a month and around 100 reads for every write, so it's very read-heavy. The API is a POST to create, which returns the short code, and a GET on the short code, which returns a redirect. For storage, it's a simple key-value lookup from code to long URL, so a key-value store or a single table with the code as the primary key works. For the code itself, a 7-character base 62 string gives over 3 trillion combinations, which is plenty.

Interviewer [follow_up]: How do you generate the short code, and what happens if two requests collide?

Candidate: Two options. I could hash the long URL and take 7 characters, but then I have to check for collisions and retry with a salt. Or I use a counter and encode it in base 62, which never collides. With several servers, each one can reserve a range of counter values, say a million at a time, so they don't coordinate on every request. The downside is that sequential codes are guessable, so if that matters I'd shuffle the bits. I'd go with the counter approach.

Interviewer [follow_up]: Reads outnumber writes by a lot. How does that shape your design?

Candidate: I'd put a cache like Redis in front of the database for popular codes, since a small fraction of links get most of the clicks. Redirect servers are stateless, so I'd scale them horizontally behind a load balancer. I'd also choose the redirect status deliberately: a 301 lets browsers cache it, which saves load but means we stop seeing clicks. If we want click analytics, I'd use a 302.
```

## system-design/url-shortener/average

```text
Interviewer: Let's design a URL shortener, something like bit.ly.

Candidate: So users give us a long URL and we give back a short one, and when someone visits the short one we redirect them. I'd have an API server and a database. The database stores the short code and the long URL. When someone visits, we look up the code and redirect.

Interviewer [follow_up]: How do you generate the short code, and what happens if two requests collide?

Candidate: I'd generate a random string of maybe 6 characters. If it already exists in the database, I'd just generate another one.

Interviewer [follow_up]: Reads outnumber writes by a lot. How does that shape your design?

Candidate: We could add a cache so popular links are faster, and maybe more servers if there's a lot of traffic.
```

## system-design/url-shortener/weak

```text
Interviewer: Let's design a URL shortener, something like bit.ly.

Candidate: I'd use a MongoDB database and a Node backend with Express, and React for the frontend. I'd deploy it on AWS with Kubernetes so it can scale.

Interviewer [hint]: Before components, what are the two main things a user does with this system?

Candidate: They make a short link and then use it. Mongo would store the links. Kubernetes handles the scaling automatically, so we wouldn't need to worry about traffic.

Interviewer [follow_up]: How do you generate the short code?

Candidate: I'd just use the MongoDB ID, it's unique.
```

## system-design/rate-limiter/strong

```text
Interviewer: Let's design a rate limiter for a public API.

Candidate: First, what do we limit by? For a public API I'd limit per API key, with a per-IP limit for unauthenticated calls. Let's say 100 requests per minute per key, with different tiers later. It should add very little latency, and when someone is limited they get a 429 with a Retry-After header. I'd put it at the API gateway so every service gets it for free. For the algorithm, a token bucket per key: it allows short bursts but enforces the average rate, and it's cheap, just a token count and a last-refill timestamp per key.

Interviewer [follow_up]: You have twenty API servers. Where do the counters live?

Candidate: In a shared store like Redis, keyed by API key, so all twenty servers see the same count. The check-and-decrement has to be atomic, so I'd use a Lua script or an atomic increment with expiry. To cut the Redis round trip, servers could keep a small local allowance and sync periodically, at the cost of slight over-admission.

Interviewer [follow_up]: What should happen if your counter store goes down: fail open or fail closed?

Candidate: For most public APIs I'd fail open, so a Redis outage doesn't become a full API outage, but with an alert and a crude local per-server limit as a backstop. For something like a login endpoint, where the limiter protects against brute force, I'd fail closed.
```

## system-design/rate-limiter/average

```text
Interviewer: Let's design a rate limiter for a public API.

Candidate: I'd count how many requests each user makes per minute, and if it's over the limit, I'd reject the request. I'd store the counts and reset them every minute.

Interviewer [follow_up]: You have twenty API servers. Where do the counters live?

Candidate: Probably in a database or Redis so all the servers can see them.

Interviewer [follow_up]: What should happen if your counter store goes down?

Candidate: Hmm, I guess we'd let requests through so the API still works.
```

## system-design/rate-limiter/weak

```text
Interviewer: Let's design a rate limiter for a public API.

Candidate: Each server would keep a counter in memory for each user and block them if they go over the limit.

Interviewer [follow_up]: You have twenty API servers. Where do the counters live?

Candidate: Each server has its own counters, so it works the same way on every server.

Interviewer [follow_up]: What does the client see when they're limited?

Candidate: They'd get an error.
```

## system-design/chat-app/strong

```text
Interviewer: Let's design a simple one-to-one chat app.

Candidate: Requirements first: send and receive messages in real time, see history, and get messages that arrived while offline. Read receipts and online status are stretch goals. Say 10 million daily users. For real time, clients keep a WebSocket connection to a connection server, since polling would waste a lot of requests. When I send a message, it goes over my socket to a chat service, which writes it to a messages store, keyed by conversation and ordered by a per-conversation sequence number, and then delivers it to the recipient's connection if they're online.

Interviewer [follow_up]: How does a message get from my phone to yours if we're connected to different servers?

Candidate: I'd keep a presence map, in Redis for example, from user ID to the connection server they're on. The chat service looks up your server and forwards the message to it, either directly or through a pub/sub channel per server. Your server pushes it down your socket. If the map has no entry, you're offline.

Interviewer [follow_up]: What happens if you're offline when I send it?

Candidate: The message is already stored, so nothing is lost. We send a push notification. When you reconnect, your client sends the last sequence number it has for each conversation and the server returns everything after it. That also handles messages missed during a flaky connection.
```

## system-design/chat-app/average

```text
Interviewer: Let's design a simple one-to-one chat app.

Candidate: Users send messages to each other, so I'd have a server and a database that stores messages. I'd use WebSockets so messages show up in real time.

Interviewer [follow_up]: How does a message get from my phone to yours if we're connected to different servers?

Candidate: Hmm, the servers would need to talk to each other somehow. Maybe a message queue between them?

Interviewer [follow_up]: What happens if you're offline when I send it?

Candidate: It's saved in the database, so you'd see it when you open the app again.
```

## system-design/chat-app/weak

```text
Interviewer: Let's design a simple one-to-one chat app.

Candidate: The app would check the server every second for new messages, and the server would return any new ones.

Interviewer [follow_up]: What happens if you're offline when I send it?

Candidate: Then you'd miss it, unless you're online. Maybe we could resend it.

Interviewer [follow_up]: How do you keep messages in the right order?

Candidate: They'd just come in the order they were sent.
```

## technical/two-sum/strong-concise

```text
Interviewer: Given an array of integers and a target number, return the indices of the two numbers that add up to the target.

Candidate: Exactly one answer, and no reusing an element? Okay. Brute force checks all pairs, O of n squared. Better: one pass with a hash map from value to index. For each number, if target minus it is in the map, return both indices; otherwise store it. O of n time, O of n space. Checking before inserting handles 3, 3 with target 6.

Interviewer [follow_up]: What if the array is already sorted? Can you do it with less extra memory?

Candidate: Two pointers from both ends. Sum too small, move left in; too big, move right in. O of n time, constant space.
```

## technical/valid-bst/weak-verbose

```text
Interviewer: How would you check whether a binary tree is a valid binary search tree?

Candidate: So binary search trees are a really important data structure. They're used in a lot of places like databases, and they give you log n lookups when they're balanced, which is why things like red-black trees and AVL trees exist to keep them balanced. The property of a BST is that the left child is smaller and the right child is bigger. So to check if a tree is valid, I'd go through every node, using either depth-first search or breadth-first search, it doesn't really matter which, and at each node I'd check that the left child's value is less than the node and the right child's value is greater than the node. If any node fails that check I return false, otherwise true. This visits each node once, so it's O of n, which is optimal because you have to look at every node at least once. I could also write it recursively, which is cleaner, where the function calls itself on the left and right subtrees.

Interviewer [follow_up]: Can you give me a tree where checking each node against only its children gives the wrong answer?

Candidate: I don't think that can happen. If every single node satisfies the property with its children, then by induction the whole tree satisfies it. Each subtree is a valid BST, so putting them together under a parent that's also valid gives you a valid BST. So the check is complete, and it's also really efficient since it's linear time and doesn't need any extra data structures besides the recursion.
```

## behavioral/failure/strong-concise

```text
Interviewer: Tell me about a time you failed or made a mistake.

Candidate: At my internship I shipped a column rename tested only locally, and it broke a nightly report in staging. I told my mentor immediately, rolled it back, and the dashboard was back by 10 a.m. The cause was that I hadn't checked other services reading that column. Now I add the new column first and remove the old one in a later release, and I search every repo that uses the database. My next rename touched three services with no breakage.

Interviewer [follow_up]: What specifically do you do differently now?

Candidate: Two steps instead of one for any rename, and a search across every repository before a schema change.
```

## behavioral/conflict/weak-verbose

```text
Interviewer: Tell me about a time you disagreed with a teammate. How did you handle it?

Candidate: Yeah so this was in my second year, in a class where we had a big group project, I think it was worth like 30 percent of the grade, and there were five of us in the group, and we were building an app, I think it was a fitness tracking app, or maybe it was the recipe one, anyway it doesn't matter. So there was this one guy on the team who always wanted to do things his own way, and honestly he was kind of difficult to work with, like he would push code without telling anyone and it would break things, and we would have to fix it. And we had a lot of meetings about it, and we talked about it a lot as a team, and people were pretty frustrated. And eventually we brought it up with the TA, and the TA talked to him, and after that things were a bit better. So we ended up finishing the project, and I think we got a pretty good grade on it in the end, maybe a B plus or an A minus.

Interviewer [follow_up]: What did your teammate believe, and why did they think that?

Candidate: I'm not really sure, he didn't really explain himself much. I think he just thought his way was better. We tried to be nice about it but it was hard because he didn't really listen to anyone, so it was mostly on him to be honest.
```

## system-design/url-shortener/strong-concise

```text
Interviewer: Let's design a URL shortener, something like bit.ly.

Candidate: Requirements: create a short link and redirect, maybe custom aliases and expiry. Very read-heavy, say 100 reads per write. APIs: POST to create, GET on the code to redirect. Storage is a key-value lookup from code to URL.

Interviewer [follow_up]: How do you generate the short code, and what happens if two requests collide?

Candidate: A counter encoded in base 62, so no collisions. Each server reserves a block of counter values so they don't coordinate per request. If guessable codes matter, shuffle the bits.

Interviewer [follow_up]: Reads outnumber writes by a lot. How does that shape your design?

Candidate: Cache hot codes in Redis, scale stateless redirect servers horizontally, and use a 302 if we want click analytics, since a 301 gets cached by browsers.
```

## system-design/rate-limiter/weak-verbose

```text
Interviewer: Let's design a rate limiter for a public API.

Candidate: So for this I'd build a microservices architecture, with a rate limiting microservice that sits alongside the other services, and I'd deploy everything on Kubernetes with autoscaling so it can handle any amount of traffic. Each instance of the API would keep a hash map in memory from user ID to the number of requests they've made, and when the number goes over the limit we block them. I'd use a really fast language like Go or Rust for this so it's performant, and I'd add monitoring with Prometheus and Grafana dashboards so we can see the traffic. We could also use machine learning to detect abusive users automatically, which would be more advanced than a fixed limit.

Interviewer [follow_up]: You have twenty API servers. Where do the counters live?

Candidate: Each server keeps its own counters in memory, which is the fastest option because there's no network call. Kubernetes load balances the traffic evenly, so each server sees about the same users, and it all works out.

Interviewer [follow_up]: What does the client see when they're limited?

Candidate: They get an error message saying they've been blocked.
```

## technical/two-sum/non-answer

```text
Interviewer: Given an array of integers and a target number, return the indices of the two numbers that add up to the target.

Candidate: Sorry, I'm not sure how to approach this.

Interviewer [hint]: As you scan the array once, what would you want to remember about the numbers you've already seen?

Candidate: I don't know, sorry.
```

## behavioral/conflict/non-answer

```text
Interviewer: Tell me about a time you disagreed with a teammate. How did you handle it?

Candidate: I can't think of anything.

Interviewer [hint]: It can be from a class project, internship, club, hackathon, research, or a part-time job.

Candidate: No, sorry, nothing comes to mind.
```

## system-design/url-shortener/non-answer

```text
Interviewer: Let's design a URL shortener, something like bit.ly.

Candidate: I haven't really done system design before. I'm not sure where to start.

Interviewer [hint]: Before components, what are the two main things a user does with this system?

Candidate: I don't know.
```
