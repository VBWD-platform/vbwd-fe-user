<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div
    class="ghrm-markdown"
    v-html="html"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ content: string }>();

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const html = computed((): string => {
  if (!props.content) return '';
  let md = props.content;
  // Code blocks (must be before inline code)
  md = md.replace(/```[\w]*\n?([\s\S]*?)```/g, (_m, code) => `<pre><code>${escHtml(code.trim())}</code></pre>`);
  // Headings
  md = md.replace(/^#{4} (.+)$/gm, '<h4>$1</h4>');
  md = md.replace(/^#{3} (.+)$/gm, '<h3>$1</h3>');
  md = md.replace(/^#{2} (.+)$/gm, '<h2>$1</h2>');
  md = md.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Bold / italic
  md = md.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  md = md.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code
  md = md.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links
  md = md.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Unordered list items
  md = md.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  md = md.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  // Paragraphs (lines not already wrapped)
  md = md.split('\n\n').map(block => {
    block = block.trim();
    if (!block) return '';
    if (/^<(h[1-6]|pre|ul|ol|li|blockquote)/.test(block)) return block;
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  return md;
});
</script>

<style scoped>
.ghrm-markdown :deep(h1), .ghrm-markdown :deep(h2), .ghrm-markdown :deep(h3) { margin: 16px 0 8px; }
.ghrm-markdown :deep(p) { margin: 0 0 12px; line-height: 1.6; }
.ghrm-markdown :deep(code) { background: #f3f4f6; padding: 2px 5px; border-radius: 3px; font-size: 0.9em; }
.ghrm-markdown :deep(pre) { background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 6px; overflow-x: auto; }
.ghrm-markdown :deep(pre code) { background: none; padding: 0; color: inherit; }
.ghrm-markdown :deep(ul) { padding-left: 20px; margin: 0 0 12px; }
.ghrm-markdown :deep(a) { color: #3498db; text-decoration: underline; }
</style>
