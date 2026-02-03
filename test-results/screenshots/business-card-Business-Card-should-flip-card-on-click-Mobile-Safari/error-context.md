# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - img
  - link "Skip to main content" [ref=e2]:
    - /url: "#main-content"
  - banner [ref=e3]:
    - navigation [ref=e5]:
      - link "no bhad codes - Go to homepage" [ref=e6]:
        - /url: /
        - text: no bhad codes
      - generic [ref=e7]:
        - button "Switch to dark theme" [ref=e8] [cursor=pointer]:
          - generic [ref=e9]:
            - img [ref=e10]
            - img [ref=e13]
        - button "Toggle navigation menu" [ref=e15] [cursor=pointer]:
          - img [ref=e17]
          - generic [ref=e24]:
            - paragraph [ref=e25]: Menu
            - paragraph [ref=e26]: Close
  - main [ref=e27]:
    - heading "No Bhad Codes - Professional Web Development" [level=1] [ref=e28]
    - generic [ref=e29]:
      - button "Business card - press Enter or Space to flip" [ref=e31] [cursor=pointer]:
        - generic:
          - img "Business Card Front"
        - generic:
          - img "Avatar"
      - navigation "Page navigation" [ref=e32]:
        - link "MY WORK" [ref=e33]:
          - /url: "#/projects"
        - link "LET'S TALK" [ref=e34]:
          - /url: "#/contact"
  - contentinfo [ref=e35]:
    - paragraph [ref=e37]: © 2026 No Bhad Codes. All rights reserved.
```