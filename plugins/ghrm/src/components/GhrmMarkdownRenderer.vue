<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div
    class="ghrm-markdown"
    v-html="html"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const props = defineProps<{ content: string }>();

// Open external links in a new tab
const renderer = new marked.Renderer();
const _linkRenderer = renderer.link.bind(renderer);
renderer.link = (token) => {
  const html = _linkRenderer(token);
  return token.href?.startsWith('http')
    ? html.replace('<a ', '<a target="_blank" rel="noopener noreferrer" ')
    : html;
};

marked.setOptions({ gfm: true, breaks: true });
marked.use({ renderer });

const html = computed((): string => {
  if (!props.content) return '';
  const raw = marked.parse(props.content) as string;
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target', 'rel'],
  });
});
</script>

<style scoped>
.ghrm-markdown :deep(h1) { font-size: 1.6em; margin: 20px 0 10px; border-bottom: 1px solid #e9ecef; padding-bottom: 6px; }
.ghrm-markdown :deep(h2) { font-size: 1.3em; margin: 18px 0 8px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px; }
.ghrm-markdown :deep(h3) { font-size: 1.1em; margin: 14px 0 6px; }
.ghrm-markdown :deep(h4), .ghrm-markdown :deep(h5), .ghrm-markdown :deep(h6) { margin: 12px 0 4px; }
.ghrm-markdown :deep(p) { margin: 0 0 12px; line-height: 1.7; }
.ghrm-markdown :deep(code) { background: #f3f4f6; padding: 2px 5px; border-radius: 3px; font-size: 0.88em; font-family: ui-monospace, 'Cascadia Code', monospace; }
.ghrm-markdown :deep(pre) { background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 6px; overflow-x: auto; margin: 0 0 14px; position: relative; }
.ghrm-markdown :deep(pre code) { background: none; padding: 0; color: inherit; font-size: 0.9em; }
.ghrm-markdown :deep(ul), .ghrm-markdown :deep(ol) { padding-left: 24px; margin: 0 0 12px; }
.ghrm-markdown :deep(li) { margin-bottom: 4px; line-height: 1.6; }
.ghrm-markdown :deep(blockquote) { border-left: 4px solid #d1d5db; margin: 0 0 12px; padding: 6px 12px; color: #6b7280; background: #f9fafb; }
.ghrm-markdown :deep(a) { color: #3498db; text-decoration: underline; }
.ghrm-markdown :deep(a:hover) { color: #2980b9; }
.ghrm-markdown :deep(table) { border-collapse: collapse; width: 100%; margin: 0 0 14px; font-size: 0.9em; }
.ghrm-markdown :deep(th) { background: #f3f4f6; font-weight: 600; padding: 8px 12px; border: 1px solid #d1d5db; text-align: left; }
.ghrm-markdown :deep(td) { padding: 7px 12px; border: 1px solid #e5e7eb; }
.ghrm-markdown :deep(tr:nth-child(even)) { background: #f9fafb; }
.ghrm-markdown :deep(hr) { border: none; border-top: 1px solid #e9ecef; margin: 20px 0; }
.ghrm-markdown :deep(img) { max-width: 100%; border-radius: 4px; }
</style>
