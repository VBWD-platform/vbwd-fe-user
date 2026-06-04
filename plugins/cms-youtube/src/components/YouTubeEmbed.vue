<template>
  <div
    v-if="videoId"
    class="cms-youtube"
  >
    <iframe
      class="cms-youtube__iframe"
      :src="embedSrc"
      :title="title"
      loading="lazy"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * cms-youtube — the worked extension proving media-extensibility (master D10).
 * A privacy-friendly, responsive YouTube embed rendered from a `youtube`
 * content block: `data = { video_id | url, title? }`. Uses
 * youtube-nocookie.com, lazy iframe, a 16:9 aspect box, and a `title` for a11y.
 * Registered at placement `top` so any post with a youtube block shows the
 * video as the topmost element.
 */
import { computed } from 'vue';

const props = defineProps<{
  data: { video_id?: string | null; url?: string | null; title?: string | null };
}>();

const NOCOOKIE_BASE = 'https://www.youtube-nocookie.com/embed/';
const VIDEO_ID_PATTERN = /^[\w-]{6,}$/;

function extractVideoId(): string {
  const explicit = props.data?.video_id;
  if (explicit && VIDEO_ID_PATTERN.test(explicit)) return explicit;

  const url = props.data?.url;
  if (!url) return '';

  // https://www.youtube.com/watch?v=<id>
  const watchMatch = url.match(/[?&]v=([\w-]+)/);
  if (watchMatch) return watchMatch[1];

  // https://youtu.be/<id>  or  https://www.youtube.com/embed/<id>
  const pathMatch = url.match(/(?:youtu\.be\/|\/embed\/)([\w-]+)/);
  if (pathMatch) return pathMatch[1];

  return '';
}

const videoId = computed(extractVideoId);
const embedSrc = computed(() => `${NOCOOKIE_BASE}${videoId.value}`);
const title = computed(() => props.data?.title ?? 'YouTube video');
</script>

<style scoped>
.cms-youtube {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  margin: 0 0 1.5rem;
  background: #000;
}
.cms-youtube__iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
