package vn.flowery.staff;

public final class AllTests {
    private AllTests() {
    }

    public static void main(String[] args) throws Exception {
        JsonTest.run();
        NavigationIconTest.run();
        ApiIntegrationTest.run();
        System.out.println("Windows App tests: PASSED");
    }
}

