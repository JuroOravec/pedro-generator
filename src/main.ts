import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Vuetify - See https://vuetifyjs.com/en/getting-started/installation/#existing-projects
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import mixpanel from 'mixpanel-browser'

import App from './App.vue'

mixpanel.init('9ee02d4a064c2071b581e26edcf4eb90', {
  track_pageview: true,
  persistence: 'localStorage'
})

const app = createApp(App)

const vuetify = createVuetify({
  components,
  directives,
  // See https://vuetifyjs.com/en/features/icon-fonts/
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
})  

app.use(createPinia())
app.use(vuetify)

app.mount('#app')
