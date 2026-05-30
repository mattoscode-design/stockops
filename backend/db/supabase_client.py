from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

_url = os.getenv("SUPABASE_URL")
_service_key = os.getenv("SUPABASE_SERVICE_KEY")
_anon_key = os.getenv("SUPABASE_ANON_KEY")

if not _url or not _service_key:
    raise RuntimeError("SUPABASE_URL ou SUPABASE_SERVICE_KEY nao configurados no .env")

if not _anon_key:
    raise RuntimeError("SUPABASE_ANON_KEY nao configurado no .env")

# Client com service_role — uso exclusivo do backend (nunca expor ao frontend)
supabase: Client = create_client(_url, _service_key)

# Client para login/OTP via Supabase Auth.
supabase_auth: Client = create_client(_url, _anon_key)

# Client isolado para validacao de JWT sem compartilhar sessao do fluxo de login.
supabase_auth_verify: Client = create_client(_url, _anon_key)
