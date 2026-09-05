function validateRegisterInput(data: {
    email?: string;
    password?: string;
    role?: string;
  }) {
    const allowedRoles = ["restaurant", "charity", "driver", "admin"];
  
    if (!data.email || !data.email.includes("@")) {
      return { valid: false, error: "Invalid email" };
    }
  
    if (!data.password || data.password.length < 6) {
      return { valid: false, error: "Password is too short" };
    }
  
    if (!data.role || !allowedRoles.includes(data.role)) {
      return { valid: false, error: "Invalid role" };
    }
  
    return { valid: true };
  }
  
  describe("Register input validation", () => {
    test("accepts valid restaurant user", () => {
      expect(
        validateRegisterInput({
          email: "restaurant@test.com",
          password: "123456",
          role: "restaurant"
        })
      ).toEqual({ valid: true });
    });
  
    test("rejects invalid email", () => {
      expect(
        validateRegisterInput({
          email: "wrong-email",
          password: "123456",
          role: "restaurant"
        })
      ).toEqual({ valid: false, error: "Invalid email" });
    });
  
    test("rejects short password", () => {
      expect(
        validateRegisterInput({
          email: "user@test.com",
          password: "123",
          role: "charity"
        })
      ).toEqual({ valid: false, error: "Password is too short" });
    });
  
    test("rejects invalid role", () => {
      expect(
        validateRegisterInput({
          email: "user@test.com",
          password: "123456",
          role: "unknown"
        })
      ).toEqual({ valid: false, error: "Invalid role" });
    });
  });