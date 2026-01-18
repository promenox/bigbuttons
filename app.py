# fastapi module
# https://fastapi.tiangolo.com/#create-it
from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.templating import Jinja2Templates
from fastapi import Request
from fastapi import Body
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# mongodb module
from pymongo import MongoClient

# dotenv module
from dotenv import load_dotenv

# os module
import os

# ---- MongoDB ----
# looks for env declaration or returns default 
# https://note.nkmk.me/en/python-os-environ-getenv/#osenvironget

load_dotenv() # this pulls the variables from your .env file
MONGO_URI = os.getenv("MONGO_URI")

# declaring fastapi app
app = FastAPI(title="Big Red Button API")

# ---- CORS (safe for local dev) ----
# relaxing security for cross origin
# https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = MongoClient(MONGO_URI)

# ~~~ testing w/ terminal ~~~
# CONNECT -->
# mongosh "mongodb+srv://bigbutton.2m5mout.mongodb.net/" --apiVersion 1 --username kimber --password 'os7687te$t'
# 
# > show dbs(shows avalible dbs - test is default)
# 
# https://www.geeksforgeeks.org/mongodb/mongodb-database-collection-and-document/
# 
# the database is test but collection is button
collection = client.test.button

# ensure the docs exist
# https://www.geeksforgeeks.org/mongodb/mongodb-crud-operations/
collection.update_one(
    {"name": "BigRed"},
    {"$setOnInsert": {"pressCount": 0}}, # only when first inserted into db 
    upsert=True
)

collection.update_one(
    {"name": "BigBlue"},
    {"$setOnInsert": {"pressCount": 0}}, # only when first inserted into db 
    upsert=True
)
# ~~~ testing w/ terminal ~~~
# https://www.mongodb.com/docs/manual/reference/mql/query-predicates/#std-label-query-projection-operators-top
#
# > db.button.findOne({name: "BigBlue"})
# > db.button.find()

# ---- Serve static files (JS / CSS) ----
# https://fastapi.tiangolo.com/tutorial/static-files/
app.mount("/static", StaticFiles(directory="."), name="static")

# ---- Routes ----
templates = Jinja2Templates(directory="./")

# displays the button clicker page

# READ again for understanding --- 

@app.get("/")
async def read_root(request: Request):
    # Fetch initial counts once during page load
    red_data = collection.find_one({"name": "BigRed"})
    blue_data = collection.find_one({"name": "BigBlue"})
    
    return templates.TemplateResponse("index.html", {
        "request": request,
        "initialRed": red_data.get("pressCount", 0),
        "initialBlue": blue_data.get("pressCount", 0)
    })

# READ again for understanding --- 

# red button batched inc
@app.post("/increment_red")
def increment(count: int = Body(..., embed=True)):
    # assumes 'count' is num of new clicks (e.g., 10) 
    collection.update_one(
        {"name": "BigRed"},
        {"$inc": {"pressCount": count}},
        # when using $inc, we don't need to know the current num.
        upsert=True
    )
    
    # I will manage the hybrid model flow myself.  

    # button = collection.find_one({"name": "BigRed"})
    # return {"pressCount": button["pressCount"]}

# blue button batched inc
@app.post("/increment_blue")
def increment(count: int = Body(..., embed=True)):
    collection.update_one(
        {"name": "BigBlue"},
        {"$inc": {"pressCount": count}},
        upsert=True
    )

@app.get("/status")
def status():
    redButton = collection.find_one({"name": "BigRed"})
    blueButton = collection.find_one({"name": "BigBlue"})

    # added an excpetion for if one of the docs is missing
    if not redButton or not blueButton:
        raise HTTPException(status_code=500, detail="Button documents missing")
    
    return {
        "countRed": redButton["pressCount"],
        "countBlue": blueButton["pressCount"]
    }

# file routing save test -->
@app.post("/save-test")
async def save_test():
    with open("test.txt", "w") as f:
        f.write("TRUE")
    # return {"message": "File written successfully!"}

# setting the uvicorn profile so I can run the server instace straight from the .py file
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)