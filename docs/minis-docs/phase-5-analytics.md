> ## Documentation Index
> Fetch the complete documentation index at: https://minis-workflow.mintlify.site/llms.txt
> Use this file to discover all available pages before exploring further.

# Phase 5: Analytics with Mixpanel [optional]

> Once the Mini is live end-to-end, wire up product analytics and turn usage data into retention.

Once the Mini is live end-to-end, wire up product analytics.

### Step 1: Set up tracking

In your AI IDE, with the Mixpanel MCP configured:

```text theme={null}
Set up Mixpanel tracking in this project. My project token is
<your-project-token>.

Use the Mixpanel setup skill:
https://storage.googleapis.com/cdn-mxpnl-com/libs/mixpanel-skill/skill.md
```

### Step 2: Turn tracking into insight

Tracking is just storing events; the value comes from how you visualize and interpret that data. For each Mini, think through:

* What activities/events actually signal engagement or value for this Mini?
* What week-over-week (WoW) trends matter?
* What's the qualifying metric for "this user is worth marketing to"?

### Step 3: Close the loop with growth

**1. Identify qualifying users**

Set Mixpanel triggers/reports for users who cross your qualifying engagement metric, tracked WoW.

**2. Cross-reference with our DB**

Pull the `user_id` from our internal DB for matched users.

**3. Segment B2B vs B2C**

Check the admin panel to determine if the user is B2B or B2C.

**4. Act on B2C, unpurchased users**

If B2C and they haven't purchased a plan, market via WhatsApp, email, or MantraAssist, and where it makes sense, schedule a 1:1 call to understand their need and close the sale.

> [!NOTE]
>
> This loop has a proven real-world turnaround; the implementation creativity for exactly which metrics and messaging to use is intentionally left in your hands.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.