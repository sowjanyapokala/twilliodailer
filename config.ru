require './client-acd.rb'
run Sinatra::Application 
config.action_dispatch.default_headers = {
    'Access-Control-Allow-Origin' => '*',
    'Access-Control-Request-Method' => %w{GET POST OPTIONS}.join(",")
  }