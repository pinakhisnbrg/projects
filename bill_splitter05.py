import easygui
import pprint
db = {}
payment = ["Mobile Transactions","Card Transaction"]
yesno = ["Yes", "No"]
try:
    # Entered by the Restaurant Employee
    amt = float(easygui.enterbox("Enter the billing amount - ", "MADHUBAN - Bill Splitter"))
except TypeError:
    exit()
except ValueError :
    amt = float(easygui.enterbox("Please enter numerical value\nEnter the billing amount - ", "MADHUBAN - Bill Splitter"))
p = easygui.integerbox("Enter the number of people ", "MADHUBAN - Bill Splitter")
amt = int(amt)
a = amt/p
msg1 = "Your amount to be paid is\n" , "Rs.", a
n = 0
name = "None"
def till(n):
    while n<1000000000 or n>9999999999:
        try:
            n = easygui.enterbox("Please enter your 10 digit mobile number","MADHUBAN - Customer's Mobile Number")
            if n == None:
                break
            n=int(n)
        except:
            easygui.msgbox("Please enter a numerical Value","MADHUBAN - Customer's Mobile Number")
            n=0
    return n
def paymobile():
    easygui.msgbox(msg=msg1, title="MADHUBAN - Mobile Transaction", ok_button="Done", image="qr.gif")
def paycard():
    message = "Please insert your card in the machine\n Your amount to be paid is ", "Rs.", a
    easygui.msgbox(msg=message, title="MADHUBAN - Card Transaction", ok_button="OK",
                   image="C:\\Users\\Pinak Deshpande\\PycharmProjects\\Bill_Splitter\\card.gif")
for i in range(0,p):
    n = 0
    # entered by the customers
    pay = easygui.buttonbox("NEW CUSTOMER\n\n Thank You\nFor choosing Madhuban\nHow do you wish to pay ?",title="MADHUBAN - Bill Splitter",choices=payment)
    if pay==None:
        easygui.msgbox("Complete amount is not paid\nPlease start again", "MADHUBAN - Bill Splitter")
        exit()
    elif pay == payment[0]:
        if p != 1:
            if i == 0:
                c1 = easygui.buttonbox("Will everybody pay through mobile transaction?","MADHUBAN - Mobile Transaction", choices=yesno, image="iphone.gif")
                if c1 == yesno[0]:
                    name = easygui.enterbox("Enter your name", "MADHUBAN - Customer's Name ")
                    if name==None:
                        paymobile()
                    else:
                        n = till(n)
                        # Insert an QR code image
                        paymobile()
                        break
                elif c1 == yesno[1]:
                    name = easygui.enterbox("Enter your name", "MADHUBAN - Customer's Name ")
                    if name == None:
                        paymobile()
                    n = till(n)
                    # Insert an QR code image
                    paymobile()
                    continue
        name = easygui.enterbox("Enter your name", "MADHUBAN - Customer's Name")
        if name==None:
            paymobile()
        n = till(n)
        # Insert an QR code image
        paymobile()
    elif pay == payment[1]:
        name = easygui.enterbox("Enter your name", "MADHUBAN - Customer's Name")
        if name==None:
            paycard()
        n = till(n)
        paycard()
        if p == 1:
            break
    db[name] = n
db[name] = n
print(db.items())
f = open("C:\\Users\\Pinak Deshpande\\PycharmProjects\\Bill_Splitter\\Database.txt", "a")
f.writelines(pprint.pformat(db))
f.close()
easygui.msgbox("Thank You\nWe hope you had a wonderful meal\nPlease consider visiting again", "MADHUBAN - Transaction Successful")