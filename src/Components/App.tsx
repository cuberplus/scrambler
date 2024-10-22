import React from 'react';
import "../CSS/Style.css";
import { Row, Col, Card, Navbar, Button } from 'react-bootstrap'
import { ScrambleDisplay } from "scramble-display"
import { PNG, Type as CubeType, SVG } from "sr-puzzlegen"


function App() {

  //let scramble = new ScrambleDisplay();
  //scramble.scramble = "F' D F2 L2 U' R2 U' F2 D2 R2 F2 U2 F R' B F D' B2 U";
  //scramble.visualization = "2D";

  // https://tdecker91.github.io/puzzlegen-demo/

  let options = {
    "width": 250,
    "height": 250,
    "puzzle": {
      "alg": "F U2"
    }
  }

  let page = (
    <div className="App">
      <header className={"header"}>
        <Navbar>
          <Navbar.Brand>
            CuberPlus
          </Navbar.Brand>
        </Navbar>
      </header>
      <Row style={{ margin: 10 }}>
        <Col className='col-lg-6'>
        </Col>

        <Col className='col-lg-6'>
          <Card className='p-3'>
            <a href='/' className='stretched-link'>
              <h3>
                More Coming Soon...
              </h3>
            </a>
          </Card>
        </Col>
      </Row>

    </div>
  )

  let cube: Element = document.getElementById("cube") as Element;

  let png = PNG(cube, CubeType.CUBE_NET, options);

  return page;
}

export default App;
