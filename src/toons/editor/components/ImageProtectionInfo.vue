<script setup lang="ts">
import EditorDialog from "./ui/EditorDialog.vue";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();
</script>

<template>
  <EditorDialog :open="open" title="Image protection" @update:open="(value) => emit('update:open', value)">
    <div class="editor-protection-doc">
      <p class="editor-muted">
        A quick guide to what stops our art from being scraped into someone else's AI training set — no code, just
        what's switched on and why.
      </p>

      <section>
        <h2 class="editor-list-heading">1. The image files themselves are off-limits to AI</h2>
        <p>
          Every plate, cover and card image is served from its own address —
          <code>assets.twentyseven.pictures</code> — separate from the pages people actually read. That address has one
          rule for every major AI crawler (OpenAI's GPTBot, Google's training crawler, Apple's, Common Crawl,
          Bytespider, Anthropic's): <strong>stay out</strong>. Every image response also carries a
          <code>noai, noimageai</code> tag, which is the same "do not use this for training" signal several of those
          companies have said they honour directly on the file, not just the folder.
        </p>
        <p class="editor-muted">
          In short: even a bot that's allowed to read our story pages is still refused the pictures on them.
        </p>
      </section>

      <section>
        <h2 class="editor-list-heading">2. Story pages stay open — on purpose</h2>
        <p>
          The pages people actually browse (<code>twentyseven.pictures</code>) do allow search engines and the
          "citation" AI crawlers — the ones that answer a question and link back to us, like ChatGPT's search feature or
          Perplexity. That's deliberate: we want the site found and referenced. Blocking everything would also hide us
          from that traffic. Only the raw image bytes get the hard "no."
        </p>
        <p>
          Two bots are blocked everywhere, including the story pages themselves:
          <strong>Bytespider</strong> (TikTok's crawler) and <strong>CCBot</strong> (Common Crawl) — both are bulk
          scrapers with a track record of feeding open training datasets, not citation tools.
        </p>
      </section>

      <section>
        <h2 class="editor-list-heading">3. Every published plate carries a visible watermark</h2>
        <p>
          Independent of any crawler rule, every plate that ships gets our site name baked into the pixels before it
          goes out. A robots rule can be ignored by a bad actor; a mark burned into the image travels with it even if
          someone screenshots or re-hosts the picture elsewhere.
        </p>
      </section>

      <section>
        <h2 class="editor-list-heading">4. Nothing you upload trains an AI model on its own</h2>
        <p>
          Uploading a plate, cover or character sheet to a toon does not feed any AI model. Those files just sit in
          storage until a person opens the studio and looks at them — the platform itself never sends stored images off
          to be trained on.
        </p>
        <p>
          The only time an image leaves storage toward an AI provider is when <strong>you</strong> choose to generate a
          new plate and deliberately attach a reference — a character sheet, or the previous page, so the art stays
          consistent. That's a one-off request you started: the reference goes out for that single generation only, the
          same way pasting a photo into an AI chat to ask "draw this next" would.
        </p>
      </section>

      <section>
        <h2 class="editor-list-heading">What this does and doesn't do</h2>
        <ul class="editor-protection-list">
          <li>Does — tells every major, honest AI crawler not to fetch or train on the images.</li>
          <li>Does — keeps a visible credit on the artwork if it's ever copied off-site.</li>
          <li>
            Does — leaves training entirely opt-in: an upload only reaches an AI provider when someone in the studio
            picks it as a reference for a specific generation, on purpose.
          </li>
          <li>
            Doesn't — stop a person from saving an image by hand and using it anyway. Robots rules are a request
            crawlers agree to follow, not a lock; the watermark is the backstop for that case.
          </li>
        </ul>
      </section>

      <p class="editor-muted">
        Wondering whether a specific tool respects this? It's public — anyone can check
        <a href="https://assets.twentyseven.pictures/robots.txt" target="_blank" rel="noopener">
          assets.twentyseven.pictures/robots.txt </a
        >.
      </p>
    </div>
  </EditorDialog>
</template>
