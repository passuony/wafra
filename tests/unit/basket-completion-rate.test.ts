function calculateCompletionRate(currentAmount: number, targetAmount: number): number {
    if (targetAmount <= 0) {
      throw new Error("targetAmount must be greater than 0");
    }
  
    const rate = (currentAmount / targetAmount) * 100;
  
    return Math.min(Math.round(rate), 100);
  }
  
  describe("Basket completionRate calculation", () => {
    test("returns 0 when basket is empty", () => {
      expect(calculateCompletionRate(0, 100)).toBe(0);
    });
  
    test("returns 50 when basket is half filled", () => {
      expect(calculateCompletionRate(50, 100)).toBe(50);
    });
  
    test("returns 100 when basket reaches target", () => {
      expect(calculateCompletionRate(100, 100)).toBe(100);
    });
  
    test("does not exceed 100 when contribution is more than target", () => {
      expect(calculateCompletionRate(150, 100)).toBe(100);
    });
  
    test("throws error when target amount is zero", () => {
      expect(() => calculateCompletionRate(10, 0)).toThrow(
        "targetAmount must be greater than 0"
      );
    });
  });