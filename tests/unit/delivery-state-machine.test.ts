type DeliveryStatus =
  | "pending"
  | "accepted"
  | "going_to_restaurant"
  | "waiting_for_restaurant_confirmation"
  | "picked_up"
  | "going_to_charity"
  | "arrived_at_charity"
  | "waiting_for_charity_confirmation"
  | "completed"
  | "cancelled";

const allowedTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending: ["accepted", "cancelled"],
  accepted: ["going_to_restaurant", "cancelled"],
  going_to_restaurant: ["waiting_for_restaurant_confirmation", "cancelled"],
  waiting_for_restaurant_confirmation: ["picked_up", "cancelled"],
  picked_up: ["going_to_charity", "cancelled"],
  going_to_charity: ["arrived_at_charity", "cancelled"],
  arrived_at_charity: ["waiting_for_charity_confirmation", "cancelled"],
  waiting_for_charity_confirmation: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};

function canTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

describe("Delivery State Machine", () => {
  test("allows valid transition pending -> accepted", () => {
    expect(canTransition("pending", "accepted")).toBe(true);
  });

  test("allows valid transition accepted -> going_to_restaurant", () => {
    expect(canTransition("accepted", "going_to_restaurant")).toBe(true);
  });

  test("rejects invalid transition pending -> completed", () => {
    expect(canTransition("pending", "completed")).toBe(false);
  });

  test("rejects invalid transition accepted -> completed", () => {
    expect(canTransition("accepted", "completed")).toBe(false);
  });

  test("completed cannot move to another status", () => {
    expect(canTransition("completed", "pending")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
  });
});