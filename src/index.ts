import { Hono } from 'hono'
import {serveStatic} from 'hono/bun'

const app = new Hono()

app.use('/*', serveStatic({
  root: './src/frontend/dist'
}))

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

export default app
