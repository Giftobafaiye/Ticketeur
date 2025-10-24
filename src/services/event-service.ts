import { eq } from 'drizzle-orm'
import { db } from '~/db/drizzle'
import { BaseService } from './base-service'
import { NewEvent, Event, events } from '~/db/schema/event'


export class EventService extends BaseService<typeof events> {
    protected table = events;
    constructor() {
        super();
    }
}