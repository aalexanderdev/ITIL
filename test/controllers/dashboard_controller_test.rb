require "test_helper"

class DashboardControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = users(:admin)
    @user = users(:user)
  end

  test "redirects unauthenticated access to login" do
    get root_path
    assert_redirected_to new_session_path
  end

  test "renders dashboard for authenticated admin" do
    sign_in_as(@admin)
    get root_path
    assert_response :success
    assert_select "h1", /Bienvenido/
  end

  test "renders dashboard for normal user" do
    sign_in_as(@user)
    get root_path
    assert_response :success
  end
end
