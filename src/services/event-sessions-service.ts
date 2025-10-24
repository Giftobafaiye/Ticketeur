import { eq } from 'drizzle-orm'
import { db } from '~/db/drizzle'
import { BaseService } from './base-service'
import { NewEventSession, EventSession, eventSessions } from '~/db/schema/event-session'


export class EventSessionService extends BaseService<typeof eventSessions> {
  protected table = eventSessions
  constructor() {
    super()
  }
}