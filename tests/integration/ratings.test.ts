import request from "supertest";
import app from "../../server/app";

describe("Ratings API", () => {
  test("duplicate rating returns 409 Conflict", async () => {
    const restaurant = await request(app)
      .post("/api/register")
      .send({
        name: "Rated Restaurant",
        email: `rated_restaurant_${Date.now()}@test.com`,
        password: "123456",
        role: "restaurant"
      });

    const charity = await request(app)
      .post("/api/register")
      .send({
        name: "Rating Charity",
        email: `rating_charity_${Date.now()}@test.com`,
        password: "123456",
        role: "charity"
      });

    const charityToken = charity.body.token;

    const payload = {
      ratedUserId: restaurant.body.user.id,
      rating: 5,
      comment: "Good cooperation",
      requestId: 1
    };

    await request(app)
      .post("/api/ratings")
      .set("Authorization", `Bearer ${charityToken}`)
      .send(payload);

    const duplicate = await request(app)
      .post("/api/ratings")
      .set("Authorization", `Bearer ${charityToken}`)
      .send(payload);

    expect(duplicate.status).toBe(409);
  });
});