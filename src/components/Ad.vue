<template>
  <ins
    class="adsbygoogle"
    :style="{ display: 'block' }"
    data-ad-client="ca-pub-4316543732300993"
    :data-ad-slot="adSlot"
    data-ad-format="auto"
    data-full-width-responsive="true"
  ></ins>
</template>

<script>
export default {
  props: {
    adSlot: String
  },
  mounted() {
    ;(this.$adsbygoogle = window.adsbygoogle || []).push({})
  }
}
</script>
