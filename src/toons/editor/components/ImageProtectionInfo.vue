<script setup lang="ts">
import EditorDialog from "./ui/EditorDialog.vue";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();
</script>

<template>
  <EditorDialog :open="open" title="Image protection" @update:open="(value) => emit('update:open', value)">
    <div class="editor-protection-doc">
      <p class="editor-muted">
        If you're worried about your art ending up training someone else's AI model — that's a reasonable thing to worry
        about right now, and worth a straight answer rather than a reassuring one. Here's exactly what's switched on,
        what it actually stops, and where we're honest that a promise can't be made.
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
        <h2 class="editor-list-heading">5. Work in progress isn't published, indexed, or announced</h2>
        <p>
          A draft toon, an unfinished page, a character sheet you just uploaded — none of that is linked from anywhere
          public. It's not in the sitemap, not in <code>/llms.txt</code>, not on any catalog card, until someone here
          deliberately flips it to Public. Search engines and citation crawlers only ever see what's actually shipped.
        </p>
        <p class="editor-muted">
          One honest caveat: the studio itself isn't behind a second wall of secrecy — a direct link to a file, if
          someone had it, would open. Nothing indexes or lists those links, but treat one the way you'd treat a private
          cloud-storage link: don't paste it somewhere public.
        </p>
      </section>

      <section>
        <h2 class="editor-list-heading">Questions people actually have</h2>
        <p>
          <strong>Will a big AI company train on my drawing?</strong> Not if they follow the rule they've published for
          themselves — GPTBot, Google's training crawler, Apple's and Anthropic's all say they honour exactly this
          signal. That's a real, working "no." It is not the same as a lock: it relies on a company keeping its own
          word, the way robots.txt has relied on that for every website since 1994. We can't force a bad actor to comply
          — no site can — which is exactly why the watermark exists as a second, independent line.
        </p>
        <p>
          <strong
            >When I generate a new plate, does the reference image I attach get kept by that AI tool to train
            on?</strong
          >
          Straight answer: we don't control what happens on a generation provider's own servers after they receive a
          request — that's between us and their published terms, same as any tool built on someone else's API. What we
          do control, and can promise: a reference only leaves this platform when a person here deliberately attaches it
          to a specific generation. Nothing is sent automatically, in bulk, or without someone choosing to send it.
        </p>
        <p>
          <strong>So is my work actually safe?</strong> It's protected the way a locked front door protects a house —
          real, and worth having, and not a claim that nothing bad can ever happen. If that's not enough reassurance for
          a specific piece, say so — that's a conversation worth having case by case, not a box this page can tick for
          you.
        </p>
      </section>

      <section>
        <h2 class="editor-list-heading">What this does and doesn't do</h2>
        <ul class="editor-protection-list">
          <li>Does — tells every major, honest AI crawler not to fetch or train on the images.</li>
          <li>Does — keeps a visible credit on the artwork if it's ever copied off-site.</li>
          <li>
            Does — carries a "no AI training" rights notice inside the file's own metadata (the WebP's XMP data), hidden
            but intact.
          </li>
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

      <section>
        <h2 class="editor-list-heading">6. The "no training" notice is baked into the file, not just the page</h2>
        <p>
          Every plate is a WebP file, and every one gets a rights notice written into its XMP metadata (the same kind of
          hidden metadata a camera uses for the date and lens) — a short note saying it's not licensed for AI training,
          plus a credit back to twentyseven.pictures. It travels with the file wherever it goes: download it, re-host
          it, drag it into another tool, and that notice is still there, the way the visible watermark is — just not
          visible to a person looking at the picture.
        </p>
        <p class="editor-muted">
          Same honest caveat as the rest of this page: metadata like this can be stripped in one command by anyone who
          wants to. It's not a lock either — it's one more place the "please don't train on this" request is written
          down, on top of the crawler rule, the header, and the visible mark.
        </p>
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
