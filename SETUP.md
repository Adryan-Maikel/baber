# 🛠️ Setup do Projeto - Barbearia Balhego

Guia de configuração completo para rodar o projeto localmente ou no PythonAnywhere.

## 1. Arquivo `.env`

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# ===== OBRIGATÓRIAS =====

# Chave secreta para JWT e sessões (gere uma única e segura)
SECRET_KEY=sua-chave-secreta-aqui-mude-isso

# ===== BANCO DE DADOS =====

# SQLite (padrão local - não precisa configurar nada)
# DATABASE_URL=sqlite:///./barbershop.db

# MySQL (PythonAnywhere)
# DATABASE_URL=mysql+mysqlconnector://SEU_USUARIO:SUA_SENHA@SEU_USUARIO.mysql.pythonanywhere-services.com/SEU_USUARIO$barbershop

# ===== EMAIL (Gmail SMTP) =====

# Email que vai enviar as notificações
EMAIL_ADDRESS=seu-email@gmail.com

# Senha de App do Gmail (NÃO é a senha normal do Gmail!)
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx

# ===== OPCIONAIS =====

# Tempo de expiração do token (minutos, padrão: 1440 = 24h)
# ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Origens permitidas (CORS)
# ALLOWED_ORIGINS=https://seu-dominio.com,https://www.seu-dominio.com
```

## 2. Como Criar a Senha de App do Gmail

1. Acesse [myaccount.google.com](https://myaccount.google.com)
2. Vá em **Segurança**
3. Ative a **Verificação em 2 etapas** (se ainda não tiver)
4. Após ativar, vá em **Verificação em 2 etapas** → **Senhas de app**
5. Em "Selecionar app", escolha **Outro** e digite `Barbearia Balhego`
6. Clique em **Gerar**
7. Copie a senha de 16 caracteres gerada e cole no `EMAIL_PASSWORD` do `.env`

> ⚠️ **IMPORTANTE:** Nunca use sua senha normal do Gmail. Use sempre a Senha de App.

## 3. Instalação Local

```bash
# Criar ambiente virtual
python -m venv env

# Ativar (Windows)
env\Scripts\activate

# Ativar (Linux/Mac)
source env/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Rodar o projeto
python app.py
```

O projeto estará rodando em `http://localhost:8000`.

## 4. PythonAnywhere

### Variáveis de Ambiente
No PythonAnywhere, configure as variáveis no arquivo `.env` na raiz do projeto ou diretamente no arquivo WSGI:

```python
import os
os.environ['SECRET_KEY'] = 'sua-chave-secreta'
os.environ['DATABASE_URL'] = 'mysql+mysqlconnector://...'
os.environ['EMAIL_ADDRESS'] = 'seu-email@gmail.com'
os.environ['EMAIL_PASSWORD'] = 'xxxx xxxx xxxx xxxx'
```

### SMTP no PythonAnywhere
O PythonAnywhere em contas gratuitas permite SMTP para o Gmail. Certifique-se de que:
- `SMTP_HOST` = `smtp.gmail.com`
- `SMTP_PORT` = `587`

## 5. Checklist de Configuração

- [ ] Arquivo `.env` criado com `SECRET_KEY`
- [ ] Banco de dados configurado (SQLite local ou MySQL no PythonAnywhere)
- [ ] Email Gmail configurado com Senha de App
- [ ] `pip install -r requirements.txt` executado
- [ ] Projeto iniciado sem erros: `python app.py`
