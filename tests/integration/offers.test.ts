import request from "supertest";
import app from "../../server/app";

describe("Offers API", () => {
  test("POST /api/offers without token returns 401", async () => {
    const res = await request(app)
      .post("/api/offers")
      .send({
        title: "Bread",
        description: "Fresh bread",
        quantity: 10,
        expiryDate: new Date().toISOString()
      });

    expect(res.status).toBe(401);
  });
});