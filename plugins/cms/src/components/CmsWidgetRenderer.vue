<template>
  <!-- HTML widget: decoded from content_json.content (base64) + source_css -->
  <div v-if="widget.widget_type === 'html'" class="cms-widget cms-widget--html">
    <!-- eslint-disable-next-line vue/no-v-html -->
    <component :is="'style'" v-if="widgetCss">{{ widgetCss }}</component>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-html="widgetHtml" />
  </div>

  <!-- Menu widget: render as nav (supports source_css for full burger-menu styling) -->
  <nav v-else-if="widget.widget_type === 'menu'" class="cms-widget cms-widget--menu">
    <component :is="'style'" v-if="widgetCss">{{ widgetCss }}</component>
    <button
      class="cms-burger"
      :class="{ 'cms-burger--open': menuOpen }"
      type="button"
      aria-label="Toggle menu"
      @click="menuOpen = !menuOpen"
    >
      <span /><span /><span />
    </button>
    <div
      class="cms-menu-overlay"
      :class="{ 'cms-menu-overlay--open': menuOpen }"
      @click="menuOpen = false"
    />
    <ul class="cms-menu" :class="{ 'cms-menu--open': menuOpen }">
      <li
        v-for="item in rootItems"
        :key="item.id"
        class="cms-menu__item"
        :class="{ 'cms-menu__item--has-children': childrenOf(item.id).length > 0 }"
      >
        <a
          :href="childrenOf(item.id).length ? '#' : itemHref(item)"
          :target="item.target || '_self'"
          class="cms-menu__link"
          @click="childrenOf(item.id).length ? toggleSub($event, item.id) : undefined"
        >
          {{ item.label }}
          <span v-if="childrenOf(item.id).length" class="cms-menu__arrow" :class="{ 'cms-menu__arrow--open': openSubs.includes(item.id) }">▾</span>
        </a>
        <ul
          v-if="childrenOf(item.id).length"
          class="cms-menu__sub"
          :class="{ 'cms-menu__sub--open': openSubs.includes(item.id) }"
        >
          <li v-for="child in childrenOf(item.id)" :key="child.id" class="cms-menu__item">
            <a :href="itemHref(child)" :target="child.target || '_self'" class="cms-menu__link">
              {{ child.label }}
            </a>
          </li>
        </ul>
      </li>
    </ul>
  </nav>

  <!-- Slideshow widget: simple image carousel -->
  <div v-else-if="widget.widget_type === 'slideshow'" class="cms-widget cms-widget--slideshow">
    <div v-if="!slideshowImages.length" class="cms-slideshow--empty" />
    <div v-else class="cms-slideshow">
      <div
        v-for="(img, idx) in slideshowImages"
        :key="idx"
        class="cms-slide"
        :class="{ 'cms-slide--active': idx === activeSlide }"
      >
        <img :src="img.url" :alt="img.alt || ''" class="cms-slide__img">
        <p v-if="img.caption" class="cms-slide__caption">{{ img.caption }}</p>
      </div>
      <button
        v-if="slideshowImages.length > 1"
        class="cms-slide__prev"
        type="button"
        @click="prevSlide"
      >‹</button>
      <button
        v-if="slideshowImages.length > 1"
        class="cms-slide__next"
        type="button"
        @click="nextSlide"
      >›</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import type { CmsWidgetData, CmsMenuItemData } from '../stores/useCmsStore';

const props = defineProps<{
  widget: CmsWidgetData;
}>();

// ── HTML widget helpers ────────────────────────────────────────────────────────

const widgetHtml = computed(() => {
  const b64 = (props.widget.content_json as any)?.content;
  if (!b64) return '';
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return b64;
  }
});

const widgetCss = computed(() => props.widget.source_css ?? '');

// ── Menu helpers ───────────────────────────────────────────────────────────────

const menuItems = computed<CmsMenuItemData[]>(() => props.widget.menu_items ?? []);
const rootItems = computed(() => menuItems.value.filter(i => !i.parent_id));
const menuOpen = ref(false);
const openSubs = ref<string[]>([]);

function childrenOf(parentId: string) {
  return menuItems.value.filter(i => i.parent_id === parentId);
}

function itemHref(item: CmsMenuItemData) {
  if (item.url) return item.url;
  if (item.page_slug) return `/${item.page_slug}`;
  return '#';
}

function toggleSub(e: Event, id: string) {
  e.preventDefault();
  const idx = openSubs.value.indexOf(id);
  if (idx > -1) openSubs.value.splice(idx, 1);
  else openSubs.value.push(id);
}

function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') { menuOpen.value = false; openSubs.value = []; } }
function onDocClick(e: MouseEvent) {
  const nav = (e.target as Element).closest('.cms-widget--menu');
  if (!nav) { openSubs.value = []; menuOpen.value = false; }
}
onMounted(() => { document.addEventListener('keydown', onEsc); document.addEventListener('click', onDocClick); });
onUnmounted(() => { document.removeEventListener('keydown', onEsc); document.removeEventListener('click', onDocClick); });

// ── Slideshow helpers ──────────────────────────────────────────────────────────

const slideshowImages = computed<{ url: string; alt: string; caption: string }[]>(() => {
  const images = (props.widget.content_json as any)?.images;
  if (!Array.isArray(images)) return [];
  return images.map((i: any) => ({ url: i.url ?? '', alt: i.alt ?? '', caption: i.caption ?? '' }));
});

const activeSlide = ref(0);
function prevSlide() {
  activeSlide.value = (activeSlide.value - 1 + slideshowImages.value.length) % slideshowImages.value.length;
}
function nextSlide() {
  activeSlide.value = (activeSlide.value + 1) % slideshowImages.value.length;
}
</script>

<style scoped>
.cms-widget--html { width: 100%; }
/* Menu — structural only; ALL display logic in widget source_css */
.cms-widget--menu { width: 100%; position: relative; }
.cms-menu { list-style: none; margin: 0; padding: 0; }
.cms-menu__sub { list-style: none; margin: 0; padding: 0; }

/* Slideshow */
.cms-slideshow { position: relative; overflow: hidden; }
.cms-slide { display: none; }
.cms-slide--active { display: block; }
.cms-slide__img { width: 100%; height: auto; display: block; }
.cms-slide__caption { text-align: center; font-size: 0.875rem; padding: 0.5rem; opacity: 0.7; }
.cms-slide__prev,
.cms-slide__next { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.4); color: #fff; border: none; font-size: 2rem; cursor: pointer; padding: 0.25rem 0.75rem; border-radius: 3px; line-height: 1; }
.cms-slide__prev { left: 0.5rem; }
.cms-slide__next { right: 0.5rem; }
</style>
