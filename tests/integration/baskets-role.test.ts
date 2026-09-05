import request from "supertest";
import app from "../../server/app";

async function registerAndGetToken(role: string) {
  const res = await request(app)
    .post("/api/register")
    .send({
      name: `${role} user`,
      email: `${role}_${Date.now()}@test.com`,
      password: "123456",
      role
    });

  return res.body.token;
}

describe("Baskets role permissions", () => {
  test("restaurant cannot create basket and receives 403", async () => {
    const token = await registerAndGetToken("restaurant");

    const res = await request(app)
      .post("/api/baskets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Food Basket",
        description: "Need food items",
        targetQuantity: 100
      });

    expect(res.status).toBe(403);
  });
});