# Questions for the client: merging the programme lists

Date: 25 September 2026

## Why we are asking

Today the system has **two separate lists of kitchen programmes** (a programme is a product line,
for example BOSSA, LAIKA or ROCCA):

1. **The Design Book list.** This comes from the LEICHT catalog data. It has 120 programmes.
2. **The Lead Programs list.** This is the list your team maintains in the CRM. It has 102 active
   programmes. Leads, projects and rooms already use this list.

You asked us to merge them so there is **only one list: Lead Programs**. We agree this is the
right choice, and the code for it is ready.

Before we switch over, we compared the two lists programme by programme, matching them on the
programme number (for example `244` = BOSSA). Most programmes match. A few do not, and for those we
need you to decide what the correct answer is. We also checked each difference against the
**2026 LEICHT price book** (edition 1/2026), because that is where the catalog data comes from.

The questions are split in two groups:

- **Part A (questions 1 and 2)** must be answered **before** we switch over. If we switch without
  these answers, some programmes will disappear from the Design Book.
- **Part B (questions 3 to 7)** do not block the switch. They are corrections to the Lead Programs
  list that we noticed while comparing. You can answer them later.

For every question we explain what we found, what happens if nothing changes, and what we suggest.
You only need to reply with your choice for each one.

---

## Part A: we need these answers before switching over

### Question 1: ROCCA 01 to 05 (and ROCCA-C 01 to 05)

**What we found**

- The Design Book has **five** ROCCA programmes: ROCCA 01, ROCCA 02, ROCCA 03, ROCCA 04 and
  ROCCA 05 (numbers 201 to 205). It has five ROCCA-C programmes as well (numbers 701 to 705).
- The Lead Programs list has **only one** "Rocca" programme (number 201) and one "Rocca-C"
  programme (number 701).
- The five ROCCA programmes offer **exactly the same products**. The only difference between them
  is the **price**. The 2026 price book shows them as price group 8 plus an extra charge:
  "8 + 70%", "8 + 100%", "8 + 110%" and so on. The extra charge seems to depend on the natural
  stone colour chosen.

**What happens if nothing changes**

After the switch, only ROCCA 01 and ROCCA-C 01 would appear in the Design Book programme list.
ROCCA 02 to 05 and ROCCA-C 02 to 05 would disappear. Products would still show correctly, because
all five have the same products, but the Design Book would not be able to show the higher prices of
ROCCA 02 to 05.

**Your options**

- **Option A: add them as separate programmes.** We add ROCCA 02, 03, 04, 05 and ROCCA-C 02, 03,
  04, 05 to the Lead Programs list as 8 new programmes. This is simple and works exactly like the
  Design Book today. The downside is that your team will see 5 ROCCA entries in the CRM instead of 1,
  and each one needs its own colours set up.
- **Option B: keep one Rocca programme and store the extra charge on each colour.** The CRM keeps
  one "Rocca" and one "Rocca-C" entry. Each stone colour inside it records which extra charge it
  has (70%, 100%, 110% and so on). This is tidier for your team, but it needs extra development work,
  and we need you to tell us which colour has which extra charge.

**What we suggest:** Option A, unless your team already thinks of ROCCA as a single programme with
colour-based pricing. In that case Option B is the better long-term choice.

**Please answer:** A or B. If B, please send us the list of colours and their extra charge.

---

### Question 2: CLASSIC-FF-Q (programme number 211)

**What we found**

- CLASSIC-FF-Q is in the Design Book and in the 2026 price book (price group 3).
- It is **not** in the Lead Programs list.
- The 2026 price book lists one of its colours (alpine grey) as discontinued, but the programme
  itself is still sold in its other colours.
- 1,287 products in the catalog have rules that depend on this programme, so it is actively used.

**What happens if nothing changes**

After the switch, CLASSIC-FF-Q would disappear from the Design Book programme list, and designers
could no longer pick it.

**Your options**

- **Option A: add it to the Lead Programs list.** We need you to confirm its details: price group
  3, the colours it is available in, and anything else your team normally fills in for a programme.
- **Option B: leave it out.** Only choose this if you no longer sell CLASSIC-FF-Q.

**What we suggest:** Option A.

**Please answer:** A or B. If A, please confirm the details or tell us who should add it.

---

## Part B: corrections that can wait

### Question 3: Discontinued programmes

**What we found**

The Design Book still has these 10 programmes:

| Primo | Avance | Contino |
|---|---|---|
| SELVA (218) | SELVA-A (418) | SELVA-C (718) |
| KYOTO (272) | | |
| STONE (294) | STONE-A (494) | STONE-C (794) |
| VALAIS (283) | | VALAIS-C (783) |

The Lead Programs list does not have any of them. The 2026 price book lists SELVA, KYOTO, STONE and
VALAIS on its **discontinued list**: "all decors, can be ordered until 31.03.2026". That date has
already passed.

**What happens after the switch**

These 10 programmes will no longer appear in the Design Book. We believe this is correct, because
they can no longer be ordered.

**What we suggest:** let them disappear.

**Please answer:** Yes, remove them / No, keep them (and tell us why).

---

### Question 4: Price groups that are different

**What we found**

For 7 programmes, the price group in the Lead Programs list is different from the 2026 price book:

| Programme | Number | 2026 price book | Lead Programs |
|---|---|---|---|
| BOSSA-FS | 247 | 7 | 4 |
| BOSSA-FS-C | 747 | 7 | 4 |
| F 45 | 253 | 4 | 3 |
| F 45-A | 453 | 4 | 3 |
| F 45-C | 753 | 4 | 3 |
| TERMA-Q | 267 | 7 | 6 |
| WAKUU | 280 | 6 | 5 |

The Design Book already uses the 2026 price book values. The Lead Programs values look like they
come from an older price list.

**Why it matters**

The Design Book does not use this number to calculate its prices, so the switch works either way.
But the CRM uses the Lead Programs price group. If it is out of date, quotes and lead information
in the CRM may use the wrong price group for these 7 programmes.

**Important:** changing these numbers changes what the CRM shows and calculates for these
programmes. That is why we will not change them without your approval.

**What we suggest:** update the Lead Programs list to match the 2026 price book.

**Please answer:** Yes, update them / No, keep the current values (and tell us which is right).

---

### Question 5: Contino-12 programmes marked as "Primo"

**What we found**

These 4 programmes are Contino-12 programmes (the Contino range with 12 mm fronts), but the Lead
Programs list marks their range as **"Primo"**:

| Programme | Number | Lead Programs says | Should be |
|---|---|---|---|
| ALURO-C12 | 684 | Primo | Contino |
| CLASSIC-FS-C12 | 613 | Primo | Contino |
| TOCCO-C12 | 654 | Primo | Contino |
| TOPOS-C12 | 669 | Primo | Contino |

**Why it matters**

The Design Book is not affected, because it keeps its own record of each programme's range. But
anywhere in the CRM that filters or groups programmes by range will show these 4 under Primo, which
is wrong.

**What we suggest:** change their range to Contino.

**Please answer:** Yes, change them / No, keep them as Primo (and tell us why).

---

### Question 6: "Gio" should be "GEO"

**What we found**

Programme number 224 is called **"GEO"** in the 2026 price book and in the Design Book, but
**"Gio"** in the Lead Programs list. This looks like a spelling mistake.

**Why it matters**

After the switch, the Design Book shows the names from the Lead Programs list. So designers would
see "Gio" instead of the correct name "GEO".

**What we suggest:** rename it to "GEO".

**Please answer:** Yes, rename it / No, keep "Gio".

---

### Question 7: The "qwerty" test entry

**What we found**

The Lead Programs list has an inactive entry called **"qwerty"** (number 12, price group 11, type
"qwerty"). It looks like a test entry that was never removed.

**Why it matters**

It is inactive, and it will not appear in the Design Book either way. It is only clutter.

**What we suggest:** delete it.

**Please answer:** Yes, delete it / No, keep it.

---

## Summary of answers we need

| # | Question | Blocks the switch? | Our suggestion |
|---|---|---|---|
| 1 | ROCCA 01 to 05: separate programmes or one programme with colour prices? | **Yes** | Separate programmes (A) |
| 2 | Add CLASSIC-FF-Q (211)? | **Yes** | Add it |
| 3 | Remove the discontinued SELVA, KYOTO, STONE, VALAIS programmes? | No | Remove them |
| 4 | Update 7 price groups to the 2026 price book? | No | Update them |
| 5 | Change 4 Contino-12 programmes from Primo to Contino? | No | Change them |
| 6 | Rename "Gio" to "GEO"? | No | Rename it |
| 7 | Delete the "qwerty" test entry? | No | Delete it |

Once we have the answers to questions 1 and 2, we can switch the Design Book over to the Lead
Programs list. The other answers can come later, and we will apply them when they arrive.

---

## Update, 28 September 2026: what we found after your changes

Thank you for the changes. We checked the Lead Programs list on the dev system again. Some answers
are now done, but **two things still stop us from switching over**.

### Still blocking the switch

**1. The new ROCCA programmes all use the same number.**

You added the five ROCCA programmes and their colours, which is exactly what we needed (Option A).
But all five were given the **same programme number, 201**:

| Programme | Number now | Number it should have |
|---|---|---|
| Rocca-01 | 201 | 201 |
| Rocca-02 | 201 | **202** |
| Rocca-03 | 201 | **203** |
| Rocca-04 | 201 | **204** |
| Rocca-05 | 201 | **205** |

The same happened for ROCCA-C: all five use 701, but they should be 701, 702, 703, 704 and 705.

The programme number is how the system connects a programme to its products and prices. When five
programmes share one number, the system cannot tell them apart, so for now it leaves all of them out
of the Design Book. Please change the numbers as shown above.

While you are there: the five ROCCA-C programmes are marked as range **"Primo"**. They should be
**"Contino"**, like the old "Rocca-C" entry was.

**2. CLASSIC-FF-Q (number 211) is still missing.**

It is still not in the Lead Programs list (question 2). If it is not added, it will disappear from
the Design Book when we switch over.

### Done, thank you

- **"Gio" → "Geo" (question 6).** You added a new "Geo" entry with number 224 and made the old
  "Gio" entry inactive. That works. We checked, and the old "Gio" entry is still used by 2 existing
  rooms, so please **keep it** (inactive) and do not delete it. The Design Book only shows active
  programmes, so designers will see "Geo".
- The old "Rocca" and "Rocca-C" entries are now inactive. That is also fine; please keep them too,
  because their colours are still stored on them.

### Not changed yet (these do not block the switch)

- **Question 3 (discontinued programmes):** nothing to change on your side. They will simply leave
  the Design Book.
- **Question 4 (price groups):** BOSSA-FS, F 45, TERMA-Q and WAKUU still have the old price groups.
- **Question 5 (Contino-12):** ALURO-C12, CLASSIC-FS-C12, TOCCO-C12 and TOPOS-C12 are still marked
  as "Primo".
- **Question 7 ("qwerty"):** the test entry is still there. It is inactive, so it does no harm.

### What happens next

As soon as the ROCCA numbers are fixed and CLASSIC-FF-Q is added, we can switch the Design Book
over to the Lead Programs list.
