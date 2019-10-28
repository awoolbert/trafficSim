//*************************************************************************
//                      Defines important variables
//*************************************************************************

var carCount = 20;
var carPhoneCheckPercent = 0.50; //percentage of cars that check phones
var delayTime = 10; //phone-checkers' acceleration delay in seconds
var canSize = 560; //size of the square canvas
var trackLengthM = 400; //length of outer edge of track in meters
var canCen = canSize / 2; //center of the canvas
var temp = 0; //a temporary variable
var carLengthM = 4; //length of 1 car in meters
var pi = 3.14159265358979323846264338327950288;
var outerEdgeP = canSize; //diameter of outermost circle in pixels
var mPix = pi * outerEdgeP / trackLengthM; //pixels per meter conversion rate
var innerEdgeP = outerEdgeP - 3.7 * 2 * mPix; //inner cricle diameter in pixels
var shutterSpeed = 0.3; //time (in sec) between each pass of the draw loop
var trigSin = 0;
var trigCos = 0;
var timeGap = 1.5; //desired secs behind leader
var minGapM = 2 + carLengthM; //smallest possible gap in meters behind leader
var accel = 1.0; //acceleration in m/sec^2
var decel = 2.5; //deceleration in m/sec^2
var sStar = minGapM; //a middle step in calculating the accel/decel decisions
var pastZero = 0;
var timePass = 0; //time in secs
var shutterCount = 0;
var endTest = 0; //length of test (test endpoint in timePass)


//-------------------------------------------------------------------------
//              Defines a function to draw the background + road
//-------------------------------------------------------------------------
var drawBackground = function() {

  background(0, 200, 255);

  //outer circle
  fill(0, 0, 0);
  ellipse(canCen, canCen, outerEdgeP, outerEdgeP);

  //inner cirlce
  fill(0, 200, 255);
  ellipse(canCen, canCen, innerEdgeP, innerEdgeP);

  //line to measure car flow rate
  strokeWeight(5);
  stroke(250);
  fill(255, 255, 255);
  line(canCen, 0, canCen, (outerEdgeP - innerEdgeP) / 2);

};


//-------------------------------------------------------------------------
//                          Defines the "Car" object
//-------------------------------------------------------------------------
var Car = function(size, color, speed, phoneChecking, tPos, gap, leader,
                  targetSpeed, dvdt, currentDelay) {
    this.size = size;
    this.color = color;
    this.speed = speed;
    this.phoneChecking = phoneChecking;
    this.tPos = tPos; //meters from the starting line
    this.gap = gap; //gap between cars (tPos to tPos)
    this.leader = leader; //the index (i) of the car immediately ahead
    this.targetSpeed = targetSpeed;
    this.dvdt = dvdt; //acceleration/deceleration
    this.currentDelay = currentDelay;
};


//-------------------------------------------------------------------------
//                  Defines a method for a car to generate
//-------------------------------------------------------------------------
Car.prototype.generate = function() {
    temp = random(0, 1);
    this.size = carLengthM * mPix/2; //size of the car in pixels
    this.targetSpeed = random(100, 150) * 1000/3600; //speed in m/sec
    this.speed = 0;
    this.color = color(0, 255, 0);
    //car's position on the track in meters form start line
    this.tPos = round(random(0, trackLengthM));
    this.gap = trackLengthM;
    this.leader = 0;
    this.dvdt = 0;

    //this.color = color(0, 255, 0);
    this.currentDelay = delayTime;

};


//-------------------------------------------------------------------------
//                  Defines a method for a car to be drawn
//-------------------------------------------------------------------------
Car.prototype.draw = function() {
    noStroke();
    fill(this.color);
    for(var i = -1; i < 2; i++) {
        trigSin = sin((this.tPos + i * carLengthM / 4) / trackLengthM * 2 * pi);
        trigCos = cos((this.tPos + i * carLengthM / 4) / trackLengthM * 2 * pi);
        ellipse(canCen + trigSin * (outerEdgeP/2 + innerEdgeP/2)/2, //x-position
                canCen - trigCos * (outerEdgeP/2 + innerEdgeP/2)/2, //y-position
                this.size, //car width
                this.size); //car height
    }
};


//-------------------------------------------------------------------------
//                  Defines a method for a car to move
//-------------------------------------------------------------------------
Car.prototype.move = function() { //directions to move cars
    //calculates new tPos
    this.tPos = this.tPos + this.speed * shutterSpeed
                          + 0.5 * this.dvdt * pow(shutterSpeed, 2);

    //resets postions greater than trackLengthM
    if (this.tPos > trackLengthM) {
      this.tPos = this.tPos - trackLengthM;
      pastZero++; //add to the number of cars that have past 0
    }

    //calculates new speed
    this.speed = max(0, this.speed + this.dvdt * shutterSpeed);

    //to prevent tiny movement in the jam line
    //if speed is super close to 0; stop
    if (this.speed < 0.05) {
      this.speed = 0;
    }
 };

//-------------------------------------------------------------------------
//             Defines a method for a car to decide accel/decel
//-------------------------------------------------------------------------
Car.prototype.decide = function() {

  //mistep calculation for IDM
  var sStar = minGapM + max(0, (this.speed * timeGap +
                           this.speed * (this.speed - car[this.leader].speed)
                           / (2 * sqrt(accel * decel))));

  //calculates change in position over change in time (dvdt)
  this.dvdt = accel * (1 - pow((this.speed / this.targetSpeed), 0.25) -
                      pow((sStar / (this.gap + 0.001)), 2));
 
  //to prevent tiny movement in the jam line
  //if acceleration is super close to 0; stop
  if (abs(this.dvdt) < 0.08) {
    this.dvdt = 0;
  }

  //if the car is a phone-checker
  if (this.phoneChecking) {
    if (this.currentDelay < delayTime && this.speed < 0.01) {
      
      //acceleration is greater than 0 (wants to accelerate),
      //is the jam leader (leader has already left the jam)

      if (this.dvdt > 0.1) { 
        //increase current speed by shutter speed
        this.currentDelay = this.currentDelay + shutterSpeed;
        this.color = color(255, 0, 0);
      } 

      this.dvdt = 0; //stay put

    } else {
        this.currentDelay = 0;
        this.color = color(155, 0, 0);
    }
  }
};


//-------------------------------------------------------------------------
//     Determines the leader and gap to the leader of each car
//-------------------------------------------------------------------------
var calcLeader = function() {
  for(var i = 0; i < carCount; i++) { //loops through every car
    car[i].gap = trackLengthM;
    //loops through every other car to determine car[i]'s and gap
    for(var j = 0; j < carCount; j++) {
      if (i != j) {
        var tempGap = trackLengthM;
        
        //if car[j] is in front of car[i]...
        if (car[j].tPos - car[i].tPos > 0) { 
          tempGap = car[j].tPos - car[i].tPos;
        }
        //if car[i] is in front of car[j]...
        else if (car[j].tPos - car[i].tPos < 0){
          tempGap = (car[j].tPos - car[i].tPos) + trackLengthM;
        }
        //if a smaller gap/new leader is found, 
        //redefine car[i].gap/car[i].leader
        if (tempGap < car[i].gap) {
          car[i].gap = tempGap;
          car[i].leader = j;
        }
      }
    }
  }
}


//-------------------------------------------------------------------------
//          Builds an empty array for carCount cars to be held
//-------------------------------------------------------------------------
var car = [];
//0 because no car can be less than spaceBetweenCars to 0/400 on either side
var spotsTaken = [0];

//-------------------------------------------------------------------------
//   SETUP: canvas is dimensioned and cars are generated and placed
//-------------------------------------------------------------------------
function setup() {
  var spaceBetweenCars = 3 * carLengthM;
  createCanvas(canSize,canSize);

  //-------------------------------------------------------------------------
  //loops through carCount cars, for each checking if its randomly assigned
  //spot is 'already taken' by another car
  //-------------------------------------------------------------------------

  //loops through each car to attemt to generate it
  for(var i = 0; i < carCount; i++) {
    car[i] = new Car();
    
    //flag to determine if  if a car has found an empty spot
    var validSpot = 0; 
    while(validSpot == 0) { //while there is no empty spot for a car...
      car[i].generate(); //cars are generated
      //keeps track of how many times a car has failed to find an empty spot
      var numFails = 0;
      for(var j = 0; j < spotsTaken.length; j++) {
        //if the distance between cars is too close...
        if (abs(spotsTaken[j] - car[i].tPos) < spaceBetweenCars) {
          //increments to signal a failed attempted to place the car
          numFails++;
        }
      }
      if (numFails == 0) { //the car has found a validSpot
        //adds car[i]'s spot to the array of spotsTaken
        spotsTaken.push(car[i].tPos);
        validSpot = 1; //flag is switched
      }
    }
  }


  //determines nearly exactly which cars are phone-checking based on
  //carPhoneCheckPercent
  for(var i = 0; i < carCount; i++) {
    if (i < round(carPhoneCheckPercent * carCount)) {
      car[i].phoneChecking = true;
      car[i].color = color(155, 0, 0);
    } else {
      car[i].phoneChecking = false;
      car[i].color = color(0, 255, 0);
    }
  }
}



//-------------------------------------------------------------------------
//                  A function for cars to actually move
//-------------------------------------------------------------------------
function draw() {
  shutterCount++;
  timePass = shutterCount * shutterSpeed; //time ticks by in secs
  drawBackground();
  calcLeader();
  for(var i = 0; i < carCount; i++) {
    car[i].decide();

  } //each car decides before it move or is drawn
  for(var i = 0; i < carCount; i++) {
    car[i].move(); //cars change position
    car[i].draw(); //cars are drawn in a new postion ('moved')
  }

  //determines the flow rate of cars past the point tPos = zero
  fill(255, 255, 255);
  text("pastZero = " + pastZero, canCen - 40, canCen + 20);
  text("timePass = " + round(timePass), canCen - 40, canCen);
  
  //flow rate of cars in number of cars per hour
  text("Flow Rate: " + round(pastZero/timePass * 3600), canCen - 40, 
                                                        canCen - 20);
  if (endTest == 0 && timePass >= 7200) { 
    endTest = round(pastZero/timePass * 3600);
  }
  
  //text the final flow rate
  fill(255, 255, 255);
  text("FINAL Flow Rate is " + endTest,
      canCen - 40, canCen + 60);

}
