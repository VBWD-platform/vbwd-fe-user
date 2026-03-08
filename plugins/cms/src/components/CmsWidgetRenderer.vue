<template>
  <!-- HTML widget: decoded from content_json.content (base64) + source_css -->
  <div v-if="widget.widget_type === 'html'" class="cms-widget cms-widget--html">
    <!-- eslint-disable-next-line vue/no-v-html -->
    <component :is="'style'" v-if="widgetCss">{{ widgetCss }}</component>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-html="widgetHtml" />
  </div>

  <!-- Menu widget: render as nav -->
  <nav v-else-if="widget.widget_type === 'menu'" class="cms-widget cms-widget--menu">
    <ul class="cms-menu">
      <li
        v-for="item in rootItems"
        :key="item.id"
        class="cms-menu__item"
        :class="{ 'cms-menu__item--has-children': childrenOf(item.id).length > 0 }"
      >
        <a
          :href="itemHref(item)"
          :target="item.target || '_self'"
          class="cms-menu__link"
        >{{ item.label }}</a>
        <ul v-if="childrenOf(item.id).length" class="cms-menu__sub">
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
import { computed, ref } from 'vue';
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

function childrenOf(parentId: string) {
  return menuItems.value.filter(i => i.parent_id === parentId);
}

function itemHref(item: CmsMenuItemData) {
  if (item.url) return item.url;
  if (item.page_slug) return `/${item.page_slug}`;
  return '#';
}

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
/* Menu */
.cms-widget--menu { width: 100%; }
.cms-menu { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0; }
.cms-menu__item { position: relative; }
.cms-menu__link { display: block; padding: 0.6rem 1rem; color: inherit; text-decoration: none; white-space: nowrap; }
.cms-menu__link:hover { opacity: 0.75; }
.cms-menu__sub { display: none; position: absolute; top: 100%; left: 0; background: var(--color-surface, #fff); border: 1px solid var(--color-border, #e5e7eb); border-radius: 4px; list-style: none; padding: 0.25rem 0; min-width: 160px; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.cms-menu__item--has-children:hover .cms-menu__sub { display: block; }
.cms-menu__sub .cms-menu__link { padding: 0.5rem 1rem; }

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
