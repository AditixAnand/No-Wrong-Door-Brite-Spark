# AI Usage — No Wrong Door

AI was used during the development of this project as an assistance tool, mainly for frontend development and debugging.

I used Claude and ChatGPT at different points when I was stuck on an issue, wanted to understand an error, or needed another approach to a particular problem.

## Where AI Helped

### Frontend

Claude and ChatGPT were used for some frontend-related work with React and Vite.

This included:

- Fixing UI issues
- Debugging React components
- CSS and responsive layout issues
- Improving some dashboard sections
- Handling loading, error and source-status states
- Small UI improvements such as the dark/light theme

The suggestions were then modified and integrated based on what was required for the project.

### Debugging

A major use of AI was debugging.

I used Claude and ChatGPT when I was facing issues in areas such as:

- Entity matching and scoring
- API integration
- Error handling
- Timeout handling
- XML response parsing
- Redis caching
- Frontend behaviour when a source fails

For example, while working on the matching logic, I found that the first version was marking too many records as ambiguous. I used AI as a second pair of eyes to go through the logic and identify what was causing the issue. After changing the conditions, the false ambiguous cases went from 208 to 2.

### Understanding Problems

Sometimes I also used AI to understand a particular error, library behaviour, or implementation issue before making the change myself.

It was mainly used in a question-and-debugging style rather than asking it to build complete features.

## Tools Used

**Claude**
- Frontend assistance
- Debugging
- UI issues
- Code-level problems

**ChatGPT**
- Debugging
- Understanding errors
- Frontend assistance
- Checking alternative approaches

## Final Note

AI was used as a development assistant and as another perspective when I got stuck.

The project architecture, matching approach, resilience strategy, caching design and other major implementation decisions were worked out as part of the project development. AI helped mainly with solving specific problems and debugging along the way.
