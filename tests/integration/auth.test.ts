import request from "supertest";
import app from "../../server/app";

describe("Auth API", () => {
  test("POST /api/register returns 201 and token for valid data", async () => {
    const res = await request(app)
      .post("/api/register")
      .send({
        name: "Test Restaurant",
        email: `restaurant_${Date.now()}@test.com`,
        password: "123456",
        role: "restaurant"
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("user");
    expect(res.body.user.role).toBe("restaurant");
  });

  test("POST /api/login returns 401 for wrong password", async () => {
    const email = `login_${Date.now()}@test.com`;

    await request(app)
      .post("/api/register")
      .send({
        name: "Login Test",
        email,
        password: "123456",
        role: "restaurant"
      });

    const res = await request(app)
      .post("/api/login")
      .send({
        email,
        password: "wrong_password"
      });

    expect(res.status).toBe(401);
  });
});