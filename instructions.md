# Transcriptor Workflow

## Typical Workflow

```bash
# 1. Pull any new transcripts
npm start

# 2. Ask Claude to process new transcripts into blog posts
# "Process new transcripts into blog posts"

# 3. Ask Claude to generate descriptions
# "Generate YouTube descriptions for new transcripts"

# 4. Push descriptions to YouTube
node push-descriptions.cjs
```
