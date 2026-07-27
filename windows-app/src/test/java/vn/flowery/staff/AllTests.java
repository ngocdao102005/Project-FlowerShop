package vn.flowery.staff;

public final class AllTests {
    private AllTests() {
    }

    public static void main(String[] args) throws Exception {
        JsonTest.run();
        ApiIntegrationTest.run();
        System.out.println("Windows App tests: PASSED");
    }
}
