import telebot
from telebot import apihelper
from telebot.types import InlineKeyboardButton, InlineKeyboardMarkup, Message
import os
import logging
from dotenv import load_dotenv
from backend.agents import orchestrator_response

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get values from environment variables
BOT_TOKEN = os.getenv('BOT_TOKEN')

# Validate that environment variables are loaded
if not BOT_TOKEN:
    raise ValueError("Missing BOT_TOKEN. Please check your .env file")

bot = telebot.TeleBot(BOT_TOKEN)

@bot.message_handler(commands=['start'])
def send_welcome(message):
    welcome_text = """
    Hi! I am an assistant
    Start your message with '@AI' followed by what you want me to assist with!
    
    Example: @AI Hello there!
    """
    bot.reply_to(message, welcome_text)

@bot.callback_query_handler(func=lambda call: True)
def handle_callback(call):
    """Handle button clicks"""
    if call.data == "btn1":
        bot.answer_callback_query(call.id, "You clicked Button 1!")
    elif call.data == "btn2":
        bot.answer_callback_query(call.id, "You clicked Button 2!")

@bot.message_handler(func=lambda message: True)
def reply_all(message):
    try:
        user_message = message.text
        
        if user_message.upper().startswith('@AI'):
            query = user_message[3:].strip()
            
            user_name = message.from_user.first_name
            
            if query:
                response = orchestrator_response(query)
                
                # Extract just the text to send
                result = response.get("result")
                if isinstance(result, str):
                    reply_text = result  # error case
                else:
                    reply_text = result.response  # parsed Pydantic model
                
                bot.reply_to(message, reply_text)
        
    except Exception as e:
        logger.error(f"Error in reply_all: {str(e)}")
        bot.reply_to(message, f"Sorry, I encountered an error: {str(e)}")

# Start the bot
if __name__ == "__main__":
    print("Bot is starting...")
    print("Bot is now polling for messages...")
    
    try:
        bot.infinity_polling(timeout=10, long_polling_timeout=5)
    except KeyboardInterrupt:
        print("\nBot stopped by user")
    except Exception as e:
        print(f"Bot crashed with error: {str(e)}")
