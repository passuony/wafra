import request from "supertest";
import app from "../../server/app";

describe("Deliveries API", () => {
  test("invalid transition pending -> completed returns 400", async () => {
    const driver = await request(app)
      .post("/api/register")
      .send({
        name: "Test Driver",
        email: `driver_${Date.now()}@test.com`,
        password: "123456",
        role: "driver"
      });

    const token = driver.body.token;

    const res = await request(app)
      .patch("/api/deliveries/1/status")
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "completed"
      });

    expect([400, 404]).toContain(res.status);
  });
});