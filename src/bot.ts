import './fetch-polyfill.js'

import * as core from '@actions/core'
import {ChatGPTAPI} from 'chatgpt'
import * as optionsJs from './options.js'
import * as utils from './utils.js'

export type Ids = {
  parentMessageId?: string
  conversationId?: string
}

export class Bot {
  private api: ChatGPTAPI | null = null

  private options: optionsJs.Options

  constructor(options: optionsJs.Options) {
    this.options = options
    if (process.env.OPENAI_API_KEY) {
      this.api = new ChatGPTAPI({
        apiKey: process.env.OPENAI_API_KEY
      })
    } else {
      const err =
        "Unable to initialize the OpenAI API, both 'OPENAI_API_KEY' environment variable are not available"
      throw new Error(err)
    }
  }

  chat = async (message: string, ids: Ids): Promise<[string, Ids]> => {
    let new_ids: Ids = {}
    let response = ''
    try {
      ;[response, new_ids] = await this.chat_(message, ids)
    } catch (e: any) {
      core.warning(`Failed to chat: ${e}, backtrace: ${e.stack}`)
    } finally {
      return [response, new_ids]
    }
  }

  private chat_ = async (message: string, ids: Ids): Promise<[string, Ids]> => {
    const start = Date.now()
    if (!message) {
      return ['', {}]
    }
    if (this.options.debug) {
      core.info(`sending to openai: ${message}`)
    }

    let responseText = ''

    if (this.api) {
      const opts: any = {
        timeoutMs: this.options.openai_timeout_ms
      }
      if (ids.parentMessageId) {
        opts.parentMessageId = ids.parentMessageId
      }
      try {
        responseText = await utils.retry(
          this.api.sendMessage.bind(this.api),
          [message, opts],
          this.options.openai_retries
        )
      } catch (e: any) {
        core.info(
          `response: ${responseText}, failed: ${e}, backtrace: ${e.stack}`
        )
      }
      const end = Date.now()
      core.info(`response: ${responseText}`)
      core.info(
        `openai sendMessage (including retries) response time: ${
          end - start
        } ms`
      )
    } else {
      core.setFailed('The OpenAI API is not initialized')
    }

    if (this.options.debug) {
      core.info(`openai responses: ${responseText}`)
    }
    const new_ids: Ids = {
      parentMessageId: undefined,
      conversationId: undefined
    }
    return [responseText, new_ids]
  }
}
