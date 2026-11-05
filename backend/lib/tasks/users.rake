namespace :users do
  desc "Create the first Admin account using interactive prompts"
  task create_admin: :environment do
    require "io/console"

    abort "Admin sudah ada; gunakan endpoint pengelolaan pengguna." if User.exists?(role: "admin")

    print "Nama Admin: "
    name = $stdin.gets&.strip
    print "Email Admin: "
    email = $stdin.gets&.strip
    print "Kata sandi (minimal 12 karakter): "
    password = $stdin.noecho(&:gets)&.chomp
    puts
    print "Ulangi kata sandi: "
    confirmation = $stdin.noecho(&:gets)&.chomp
    puts

    user = User.new(name: name, email: email, password: password,
      password_confirmation: confirmation, role: "admin")
    if user.save
      puts "Akun Admin berhasil dibuat untuk #{user.email}."
    else
      warn "Akun Admin tidak dapat dibuat: #{user.errors.full_messages.join(', ')}"
      exit 1
    end
  ensure
    password = nil
    confirmation = nil
  end
end
