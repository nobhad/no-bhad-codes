# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - img
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=e3]:
    - navigation [ref=e5]:
      - link "no bhad codes - Go to homepage" [ref=e6] [cursor=pointer]:
        - /url: /
        - text: no bhad codes
      - generic [ref=e7]:
        - button "Client Portal Login" [ref=e8] [cursor=pointer]:
          - img [ref=e10]
        - button "Switch to dark theme" [ref=e14] [cursor=pointer]:
          - generic [ref=e15]:
            - img [ref=e16]
            - img [ref=e19]
        - button "Toggle navigation menu" [ref=e21] [cursor=pointer]:
          - img [ref=e23]
          - generic [ref=e30]:
            - paragraph [ref=e31]: Menu
            - paragraph [ref=e32]: Close
  - generic [ref=e33]:
    - button "Business card - press Enter or Space to flip" [ref=e35] [cursor=pointer]:
      - generic:
        - img "Business Card Front"
      - generic:
        - img "Avatar"
    - navigation "Page navigation" [ref=e36]:
      - link "MY WORK" [ref=e37] [cursor=pointer]:
        - /url: "#/projects"
      - link "LET'S TALK" [ref=e38] [cursor=pointer]:
        - /url: "#/contact"
  - contentinfo [ref=e39]:
    - paragraph [ref=e41]: © 2026 No Bhad Codes. All rights reserved.
```