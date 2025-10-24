import { eq } from 'drizzle-orm'
import { db } from '~/db/drizzle'
import { BaseService } from './base-service'
import { NewTicket, Ticket, tickets } from '~/db/schema/ticket'


export class TicketService extends BaseService<typeof tickets> {
  protected table = tickets
  constructor() {
    super()
  }
}