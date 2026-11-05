ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: :number_of_processors, with: :threads)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    # Add more helper methods to be used by all tests here...
  end
end

module AuthenticatedIntegrationRequests
  def setup
    super
    @default_test_user = User.find_or_create_by!(email: "test-admin@example.test") do |user|
      user.name = "Test Admin"
      user.password = "TestAdminPassword!2026"
      user.password_confirmation = "TestAdminPassword!2026"
      user.role = "admin"
    end
    @default_test_token = AuthSession.issue_for(@default_test_user).last
  end

  %i[get post patch put delete options].each do |http_method|
    define_method(http_method) do |path, **arguments, &block|
      supplied_headers = arguments[:headers] || {}
      unless supplied_headers.key?("Authorization") || supplied_headers.key?(:Authorization)
        arguments[:headers] = supplied_headers.merge("Authorization" => "Bearer #{@default_test_token}")
      end
      super(path, **arguments, &block)
    end
  end
end

ActionDispatch::IntegrationTest.include(AuthenticatedIntegrationRequests)
