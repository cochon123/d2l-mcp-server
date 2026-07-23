# D2L Brightspace MCP Server

An MCP (Model Context Protocol) server that provides AI assistants with tools to interact with D2L Brightspace LMS.

## ⚠️ WARNING! ⚠️

This server should **not** be used in any way to engage in academic misconduct.
Do not use this MCP server to cheat on any assignments, or to gain an unfair advantage
over other students. This server is only intended for use to enable agents to
better understand your assignment scheduling and to help with your _learning_ of the
course material.

**I do not condone the use of this server in any activities that would violate the user's university's Academic Code of Conduct.**

## Features

- **Automated SSO authentication** via Playwright (handles Microsoft/institutional login)
- **Persistent session storage** - login once, use for hours
- **13 tools** for accessing assignments, grades, calendar, announcements, course content, and submissions
- **File downloads** with automatic text extraction (docx, txt, etc.)
- **Guarded assignment uploads** with confirmation, duplicate protection, and verification
- **LLM-optimized responses** - clean, token-efficient output

## Installation

```bash
npm install -g d2l-mcp-server
```

This will automatically install Chromium for browser automation.

## Setup

### 1. First-time authentication

```bash
d2l-mcp-auth
```

This opens a browser window where you log in to Brightspace. Your session is saved to `~/.d2l-session/`.

### 2. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "d2l": {
      "command": "d2l-mcp",
      "env": {
        "D2L_HOST": "learn.ul.ie",
        "D2L_COURSE_ID": "68929",
        "D2L_UPLOAD_ROOTS": "/path/to/your/projects"
      }
    }
  }
}
```

## Available Tools

### Assignments
| Tool | Description |
|------|-------------|
| `get_assignments` | List all assignments with due dates and instructions |
| `get_assignment` | Get full details for a specific assignment |
| `get_assignment_submissions` | Get your submissions, grades, and feedback |
| `submit_assignment` | Submit one confirmed local file and verify the upload |

### Course Content
| Tool | Description |
|------|-------------|
| `get_course_content` | Get complete course syllabus/structure |
| `get_course_topic` | Get details for a specific topic/lecture |
| `get_course_modules` | Get main sections/modules of a course |
| `get_course_module` | Get contents within a specific module |

### Grades & Calendar
| Tool | Description |
|------|-------------|
| `get_my_grades` | Get all your grades with scores and feedback |
| `get_upcoming_due_dates` | Get calendar events and deadlines |

### Other
| Tool | Description |
|------|-------------|
| `get_announcements` | Get course announcements from instructors |
| `get_my_courses` | List all your enrolled courses |
| `download_file` | Download and extract content from course files |

## Example Prompts

Once connected to Claude, you can ask things like:

- "What assignments are due this week?"
- "Show me my grades"
- "What announcements have been posted?"
- "Download the weekly report template"
- "What's the syllabus for this course?"
- "Submit `/path/to/project.zip` to assignment 37812 in course 68929"

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `D2L_HOST` | Your Brightspace hostname | `learn.ul.ie` |
| `D2L_COURSE_ID` | Default course ID (optional) | none |
| `D2L_UPLOAD_ROOTS` | Directories files may be uploaded from, separated by the platform path delimiter | server working directory |
| `D2L_MAX_UPLOAD_BYTES` | Maximum allowed upload size in bytes | `104857600` (100 MiB) |

Setting `D2L_COURSE_ID` allows you to omit the course ID from tool calls.

### Submission safety

`submit_assignment` changes external state. It requires `confirmed=true`, which clients
must provide only after the user explicitly approves the exact course, assignment, and
file. Existing submissions are blocked unless `allowResubmission=true` is also explicitly
approved. The initial implementation supports individual file assignments; package a
multi-file code project as a ZIP before submitting it.

For safety, configure `D2L_UPLOAD_ROOTS` to the narrowest directories containing work
you may submit. The tool resolves symbolic links, rejects files outside those roots,
enforces the configured size limit and assignment extension allowlist, and queries D2L
after uploading to verify the submitted filename and size.

## Session Management

- **Token expiry**: Auth tokens expire after ~1 hour but auto-refresh using the saved browser session
- **Session expiry**: Browser sessions expire after ~24h of inactivity
- **Re-authenticate**: Run `d2l-mcp-auth` if your session expires

## Development

```bash
# Run tests
npm test

# Run integration tests (requires auth)
npm run test:integration

# Watch mode
npm run test:watch
```

## License

MIT
