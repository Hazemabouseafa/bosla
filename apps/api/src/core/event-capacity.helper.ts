import type { Prisma } from '@bosla/db';

/**
 * Acquires a row-level `FOR UPDATE` lock on `"OfflineEvent"` inside the active transaction
 * and calculates remaining seat capacity before creating or confirming a registration.
 */
export async function lockOfflineEventAndCheckCapacity(
  db: Prisma.TransactionClient,
  params: { eventId: string; requestedSeats: number; excludeRegistrationId?: string },
): Promise<{ allowed: boolean; capacity: number; seatsBooked: number }> {
  const [lockedEvent] = await db.$queryRaw<Array<{ id: string; capacity: number }>>`
    SELECT id, capacity FROM "OfflineEvent" WHERE id = ${params.eventId} FOR UPDATE
  `;
  if (!lockedEvent) {
    return { allowed: false, capacity: 0, seatsBooked: 0 };
  }

  const bookedAgg = await db.offlineEventRegistration.aggregate({
    where: {
      eventId: params.eventId,
      ...(params.excludeRegistrationId ? { id: { not: params.excludeRegistrationId } } : {}),
      status: { in: ['CONFIRMED', 'ATTENDED'] },
    },
    _sum: { seatsCount: true },
  });

  const seatsBooked = Number(bookedAgg._sum.seatsCount ?? 0);
  return {
    allowed: seatsBooked + params.requestedSeats <= lockedEvent.capacity,
    capacity: lockedEvent.capacity,
    seatsBooked,
  };
}
